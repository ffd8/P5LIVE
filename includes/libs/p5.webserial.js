/**
 * p5.webserial
 * (c) Gottfried Haider 2021-2023
 * LGPL
 * https://github.com/gohai/p5.webserial
 * Based on documentation: https://web.dev/serial/
 */

'use strict';

(function() {


  // Can be called with ArrayBuffers or views on them
  function memcpy(dst, dstOffset, src, srcOffset, len) {
    if (!(dst instanceof ArrayBuffer)) {
      dstOffset += dst.byteOffset;
      dst = dst.buffer;
    }
    if (!(src instanceof ArrayBuffer)) {
      srcOffset += src.byteOffset;
      src = src.buffer;
    }
    const dstView = new Uint8Array(dst, dstOffset, len);
    const srcView = new Uint8Array(src, srcOffset, len);
    dstView.set(srcView);
  }


  let ports = [];
  async function getPorts() {
    try {
      if ('serial' in navigator) {
        ports = await navigator.serial.getPorts();
      } else if ('usb' in navigator) {
        // unsure if this returns "Cannot access 'serial' before initialization"
        // even with known devices present
        ports = await serial.getPorts();
      }
    } catch (error) {
      console.warn('Unable to get previously used serial ports:', error.message);
    }
  };
  getPorts();

  /**
   * Get all available serial ports used previously on this page,
   * which can be used without additional user interaction.
   * This is useful for automatically connecting to serial devices
   * on page load. Pass one of the SerialPort objects this function
   * returns to WebSerial() to do so.
   * @method usedSerialPorts
   * @return {Array of SerialPort}
   */
  p5.prototype.usedSerialPorts = function() {
    return ports;
  }


  /**
   * Create a and return a WebSerial instance.
   */
  p5.prototype.createSerial = function() {
    return new p5.prototype.WebSerial(this);
  }


  p5.prototype.WebSerial = class {

    constructor(p5inst) {
      this.options     = { baudRate: 9600 };            // for port.open()
      this.port        = null;                          // SerialPort object
      this.reader      = null;                          // ReadableStream object
      this.keepReading = true;                          // set to false by close()
      this.inBuf       = new ArrayBuffer(1024 * 1024);  // 1M
      this.inLen       = 0;                             // bytes in inBuf
      this.textEncoder = new TextEncoder();             // to convert to UTF-8
      this.textDecoder = new TextDecoder();             // to convert from UTF-8
      this.p5          = null;                          // optional p5 instance

      if ('serial' in navigator) {
        // using WebSerial API
      } else if ('usb' in navigator) {
        console.log('Using WebUSB polyfill for WebSerial');
      } else {
       throw new Error('WebSerial is not supported in your browser (try Chrome or Edge)');
      }

      if (p5inst instanceof p5) {                       // this ony argument might be a p5 instance
        this.p5 = p5inst;                               // might be used for callbacks in the future
      }
    }

    /**
     * Returns the number of characters available for reading.
     * Note: use availableBytes() to get the number of bytes instead.
     * @method available
     * @return {Number} number of Unicode characters
     */
    available() {
      const view = new Uint8Array(this.inBuf, 0, this.inLen);

      // count the number of codepoint start bytes, excluding
      // incomplete trailing characters
      let characters = 0;
      for (let i=0; i < view.length; i++) {
        const byte = view[i];
        if (byte >> 7 == 0b0) {
          characters++;
        } else if (byte >> 5 == 0b110 && i < view.length-1) {
          characters++;
        } else if (byte >> 4 == 0b1110 && i < view.length-2) {
          characters++;
        } else if (byte >> 3 == 0b11110 && i < view.length-3) {
          characters++;
        }
      }
      return characters;
    }

    /**
     * Returns the number of bytes available for reading.
     * Note: use available() to get the number of characters instead,
     * as a Unicode character can take more than a byte.
     * @method availableBytes
     * @return {Number} number of bytes
     */
    availableBytes() {
      return this.inLen;
    }

    /**
     * Change the size of the input buffer.
     * By default, the input buffer is one megabyte in size. Use this
     * function to request a larger buffer if needed.
     * @method bufferSize
     * @param {Number} size buffer size in bytes
     */
    bufferSize(size) {
      if (size != this.inBuf.byteLength) {
        const newBuf = new ArrayBuffer(size);
        const newLen = Math.min(this.inLen, size);
        memcpy(newBuf, 0, this.inBuf, this.inLen-newLen, newLen);
        this.inBuf = newBuf;
        this.inLen = newLen;
      }
    }

    /**
     * Empty the input buffer and remove all data stored there.
     * @method clear
     */
    clear() {
      this.inLen = 0;
    }

    /**
     * Closes the serial port.
     * @method close
     */
    close() {
      if (this.reader) {
        this.keepReading = false;
        this.reader.cancel();
      } else {
        console.log('Serial port is already closed');
      }
    }

    /**
     * Turns the DTR signal on or off
     * @param {Boolean} assert true to assert the signal, false to deassert it
     */
    async dtr(assert) {
      if (assert === undefined) {
        throw new Error('Pass either true or false to dtr() to turn the Data Terminal Ready signal on or off');
      } else if (assert) {
        await this.port.setSignals({ dataTerminalReady: true });
      } else {
        await this.port.setSignals({ dataTerminalReady: false });
      }
    }

    /**
     * Returns whether or not the argument is a SerialPort (either native
     * or polyfill)
     * @param {object} port
     * @return {Boolean}
     */
    isSerialPort(port) {
      const nativeSerialPort = window.SerialPort;
      return (port instanceof nativeSerialPort || port instanceof SerialPort);
    }

    /**
     * Returns the last character received.
     * This method clears the input buffer afterwards, discarding its data.
     * @method last
     * @return {String} last character received
     */
    last() {
      if (!this.inLen) {
        return '';
      }

      const view = new Uint8Array(this.inBuf, 0, this.inLen);

      let startByteOffset = null;
      let byteLength = null;

      for (let i=view.length-1; 0 <= i; i--) {
        const byte = view[i];
        if (byte >> 7 == 0b0) {
          startByteOffset = i;
          byteLength = 1;
          break;
        } else if (byte >> 5 == 0b110 && i < view.length-1) {
          startByteOffset = i;
          byteLength = 2;
          break;
        } else if (byte >> 4 == 0b1110 && i < view.length-2) {
          startByteOffset = i;
          byteLength = 3;
          break;
        } else if (byte >> 3 == 0b11110 && i < view.length-3) {
          startByteOffset = i;
          byteLength = 4;
          break;
        }
      }

      if (startByteOffset !== null) {
        const out = new Uint8Array(this.inBuf, startByteOffset, byteLength);
        const str = this.textDecoder.decode(out);

        // shift input buffer
        if (startByteOffset+byteLength < this.inLen) {
          memcpy(this.inBuf, 0, this.inBuf, startByteOffset+byteLength, this.inLen-byteLength-startByteOffset);
        }
        this.inLen -= startByteOffset+byteLength;

        return str;
      } else {
        return '';
      }
    }

    /**
     * Returns the last byte received as a number from 0 to 255.
     * Note: For the oldest byte in the input buffer, use readByte() instead.
     * This method clears the input buffer afterwards, discarding its data.
     * @method lastByte
     * @return {Number} value of the byte (0 to 255), or null if none available
     */
    lastByte() {
      if (this.inLen) {
        const view = new Uint8Array(this.inBuf, this.inLen-1, 1);
        this.inLen = 0;  // Serial library in Processing does similar
        return view[0];
      } else {
        return null;
      }
    }


    /**
     * Opens a port based on arguments
     * e.g.
     * - open();
     * - open(57600);
     * - open('Arduino');
     * - open(usedSerialPorts()[0]);
     * - open('Arduino', 57600);
     * - open(usedSerialPorts()[0], 57600);
     */
    open() {
      (async () => {
        await this.selectPort(...arguments);            // sets options and port
        await this.start();                             // opens the port and starts the read-loop
      })();
    }

    /**
     * Returns whether the serial port is open and available for
     * reading and writing.
     * @method opened
     * @return {Boolean} true if the port is open, false if not
     */
    opened() {
      return (this.isSerialPort(this.port) && this.port.readable !== null);
    }

    presets = {
      'Adafruit': [                                     // various Adafruit products
        { usbVendorId: 0x239a },
      ],
      'Arduino': [                                      // from Arduino's board.txt files as of 9/13/21
        { usbVendorId: 0x03eb, usbProductId: 0x2111 },  // Arduino M0 Pro (Atmel Corporation)
        { usbVendorId: 0x03eb, usbProductId: 0x2157 },  // Arduino Zero (Atmel Corporation)
        { usbVendorId: 0x10c4, usbProductId: 0xea70 },  // Arduino Tian (Silicon Laboratories)
        { usbVendorId: 0x1b4f },                        // Spark Fun Electronics
        { usbVendorId: 0x2341 },                        // Arduino SA
        { usbVendorId: 0x239a },                        // Adafruit
        { usbVendorId: 0x2a03 },                        // dog hunter AG
        { usbVendorId: 0x3343, usbProductId: 0x0043 },  // DFRobot UNO R3
      ],
      'MicroPython': [                                  // from mu-editor as of 9/4/22
        { usbVendorId: 0x0403, usbProductId: 0x6001 },  // M5Stack & FT232/FT245 (XinaBox CW01, CW02)
        { usbVendorId: 0x0403, usbProductId: 0x6010 },  // FT2232C/D/L/HL/Q (ESP-WROVER-KIT)
        { usbVendorId: 0x0403, usbProductId: 0x6011 },  // FT4232
        { usbVendorId: 0x0403, usbProductId: 0x6014 },  // FT232H
        { usbVendorId: 0x0403, usbProductId: 0x6015 },  // FT X-Series (Sparkfun ESP32)
        { usbVendorId: 0x0403, usbProductId: 0x601c },  // FT4222H
        { usbVendorId: 0x0694, usbProductId: 0x0009 },  // Lego Spike
        { usbVendorId: 0x0d28, usbProductId: 0x0204 },  // BBC micro:bit
        { usbVendorId: 0x10c4, usbProductId: 0xea60 },  // CP210x
        { usbVendorId: 0x1a86, usbProductId: 0x7523 },  // HL-340
        { usbVendorId: 0x2e8A, usbProductId: 0x0005 },  // Raspberry Pi Pico
        { usbVendorId: 0xf055, usbProductId: 0x9800 },  // Pyboard
      ],
      'RaspberryPi': [
        { usbVendorId: 0x2e8A },                        // various Raspberry Pi products
      ]
    };

    /**
     * Reads characters from the serial port and returns them as a string.
     * The data received over serial are expected to be UTF-8 encoded.
     * @method read
     * @param {Number} length number of characters to read (default: all available)
     * @return {String}
     */
    read(length = this.inLen) {
      if (!this.inLen || !length) {
        return '';
      }

      const view = new Uint8Array(this.inBuf, 0, this.inLen);

      // This consumes UTF-8, ignoring invalid byte sequences at the
      // beginning (we might have connected mid-sequence), and the
      // end (we might still missing bytes).

      // 0xxxxxxx
      // 110xxxxx 10xxxxxx
      // 1110xxxx 10xxxxxx 10xxxxxx
      // 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx

      let bytesToConsume = 0;
      let startByteOffset = null;
      let byteLength = null;
      let charLength = 0;

      for (let i=0; i < view.length; i++) {
        const byte = view[i];
        //console.log('Byte', byte);

        let codepointStart;
        if (byte >> 7 == 0b0) {
          codepointStart = true;
          bytesToConsume = 0;
          //console.log('ASCII character');
        } else if (byte >> 5 == 0b110) {
          codepointStart = true;
          bytesToConsume = 1;
          //console.log('Begin 2-byte codepoint');
        } else if (byte >> 4 == 0b1110) {
          codepointStart = true;
          bytesToConsume = 2;
          //console.log('Begin 3-byte codepoint');
        } else if (byte >> 3 == 0b11110) {
          codepointStart = true;
          bytesToConsume = 3;
          //console.log('Begin 4-byte codepoint');
        } else {
          codepointStart = false;
          bytesToConsume--;
          //console.log('Continuation codepoint');
        }

        if (startByteOffset === null && codepointStart) {
          startByteOffset = i;
          //console.log('String starts at', i);
        }
        if (startByteOffset !== null && bytesToConsume <= 0) {
          charLength++;
          byteLength = i-startByteOffset+1;
          //console.log('Added character', charLength, 'characters', byteLength, 'bytes');
        }
        if (length <= charLength) {
          //console.log('Enough characters');
          break;
        }
      }

      if (startByteOffset !== null && byteLength !== null) {
        const out = new Uint8Array(this.inBuf, startByteOffset, byteLength);
        const str = this.textDecoder.decode(out);
        //console.log('String is', str);

        // shift input buffer
        if (startByteOffset+byteLength < this.inLen) {
          memcpy(this.inBuf, 0, this.inBuf, startByteOffset+byteLength, this.inLen-byteLength-startByteOffset);
        }
        this.inLen -= startByteOffset+byteLength;

        return str;
      } else {
        return '';
      }
    }

    /**
     * Reads characters from the serial port up to (and including) a given
     * string to look for.
     * The data received over serial are expected to be UTF-8 encoded.
     * @method readUntil
     * @param {String} needle sequence of characters to look for
     * @return {String}
     */
    readUntil(needle) {
      let out = this.readArrayBufferUntil(needle);

      // trim leading invalid bytes, as does read()
      let startByteOffset = null;

      for (let i=0; i < out.length; i++) {
        const byte = out[i];
        if (byte >> 7 == 0b0) {
          startByteOffset = i;
          break;
        } else if (byte >> 5 == 0b110) {
          startByteOffset = i;
          break;
        } else if (byte >> 4 == 0b1110) {
          startByteOffset = i;
          break;
        } else if (byte >> 3 == 0b11110) {
          startByteOffset = i;
          break;
        }
      }

      if (startByteOffset !== null) {
        if (0 < startByteOffset) {
          out = new Uint8Array(out.buffer, out.byteOffset+startByteOffset, out.length-startByteOffset);
        }
        return this.textDecoder.decode(out);
      } else {
        return '';
      }
    }

    /**
     * Reads bytes from the serial port and returns them as Uint8Array.
     * @method readArrayBuffer
     * @param {Number} length number of bytes to read (default: all available)
     * @return {Uint8Array} data
     */
    readArrayBuffer(length = this.inLen) {
      if (this.inLen && length) {
        length = Math.min(length, this.inLen);
        const view = new Uint8Array(this.inBuf, 0, length);

        // this makes a copy of the underlying ArrayBuffer
        const out = new Uint8Array(view);

        // shift input buffer
        if (length < this.inLen) {
          memcpy(this.inBuf, 0, this.inBuf, length, this.inLen-length);
        }
        this.inLen -= length;

        return out;
      } else {
        return new Uint8Array([]);
      }
    }

    /**
     * Reads bytes from the serial port up until (and including) a given sequence
     * of bytes, and returns them as Uint8Array.
     * @method readArrayBufferUntil
     * @param {String|Number|Array of number|Uint8Array} needle sequence of bytes to look for
     * @return {Uint8Array} data
     */
    readArrayBufferUntil(needle) {
      // check argument
      if (typeof needle === 'string') {
        needle = this.textEncoder.encode(needle);
      } else if (typeof needle === 'number' && Number.isInteger(needle)) {
        if (needle < 0 || 255 < needle) {
          throw new TypeError('readArrayBufferUntil expects as an argument an integer between 0 to 255');
        }
        needle = new Uint8Array([ needle ]);
      } else if (Array.isArray(needle)) {
        for (let i=0; i < needle.length; i++) {
          if (typeof needle[i] !== 'number' || !Number.isInteger(needle[i]) ||
              needle[i] < 0 || 255 < needle[i]) {
                throw new TypeError('Array contained a value that wasn\'t an integer, or outside of 0 to 255');
          }
        }
        needle = new Uint8Array(needle);
      } else if (needle instanceof Uint8Array) {
        // nothing to do
      } else {
        throw new TypeError('Supported types are: String, Integer number (0 to 255), Array of integer numbers (0 to 255), Uint8Array');
      }

      if (!this.inLen || !needle.length) {
        return new Uint8Array([]);
      }

      const view = new Uint8Array(this.inBuf, 0, this.inLen);

      let needleMatchLen = 0;

      for (let i=0; i < view.length; i++) {
        if (view[i] === needle[needleMatchLen]) {
          needleMatchLen++;
        } else {
          needleMatchLen = 0;
        }

        if (needleMatchLen == needle.length) {
          const src = new Uint8Array(this.inBuf, 0, i+1);

          // this makes a copy of the underlying ArrayBuffer
          const out = new Uint8Array(src);

          // shift input buffer
          if (i+1 < this.inLen) {
            memcpy(this.inBuf, 0, this.inBuf, i+1, this.inLen-i-1);
          }
          this.inLen -= i+1;

          return out;
        }
      }

      return new Uint8Array([]);
    }

    /**
     * Reads a byte from the serial port and returns it as a number
     * from 0 to 255.
     * Note: this returns the oldest byte in the input buffer. For
     * the most recent one, use lastByte() instead.
     * @method readByte
     * @return {Number} value of the byte (0 to 255), or null if none available
     */
    readByte() {
      const out = this.readArrayBuffer(1);

      if (out.length) {
        return out[0];
      } else {
        return null;
      }
    }

    /**
     * Reads bytes from the serial port and returns them as an
     * array of numbers from 0 to 255.
     * @method readBytes
     * @param {Number} length number of bytes to read (default: all available)
     * @return {Array of number}
     */
    readBytes(length = this.inLen) {
      const out = this.readArrayBuffer(length);

      const bytes = [];
      for (let i=0; i < out.length; i++) {
        bytes.push(out[i]);
      }
      return bytes;
    }

    /**
     * Reads bytes from the serial port up until (and including) a given sequence
     * of bytes, and returns them as an array of numbers.
     * @method readBytesUntil
     * @param {String|Number|Array of number|Uint8Array} needle sequence of bytes to look for
     * @return {Array of number}
     */
    readBytesUntil(needle) {
      const out = this.readArrayBufferUntil(needle);

      const bytes = [];
      for (let i=0; i < out.length; i++) {
        bytes.push(out[i]);
      }
      return bytes;
    }

    /**
     * Turns the RTS signal on or off
     * @param {Boolean} assert true to assert the signal, false to deassert it
     */
    async rts(assert) {
      if (assert === undefined) {
        throw new Error('Pass either true or false to rts() to turn the Request To Send signal on or off');
      } else if (assert) {
        await this.port.setSignals({ requestToSend: true });
      } else {
        await this.port.setSignals({ requestToSend: false });
      }
    }

    /**
     * Sets this.port and this.options based on arguments passed
     * to the constructor.
     */
    async selectPort() {
      let filters = [];

      if (1 <= arguments.length) {
        if (Array.isArray(arguments[0])) {                // for requestPort(), verbatim
          filters = arguments[0];
        } else if (this.isSerialPort(arguments[0])) {     // use SerialPort as-is, skip requestPort()
          this.port = arguments[0];
          filters = null;
        } else if (typeof arguments[0] === 'object') {    // single vid/pid-containing object
          filters = [arguments[0]];
        } else if (typeof arguments[0] === 'string') {    // preset
          const preset = arguments[0];
          if (preset in this.presets) {
            filters = this.presets[preset];
          } else {
            throw new TypeError('Unrecognized preset "' + preset + '", available: ' + Object.keys(this.presets).join(', '));
          }
        } else if (typeof arguments[0] === 'number') {
          this.options.baudRate = arguments[0];
        } else {
          throw new TypeError('Unexpected first argument "' + arguments[0] + '"');
        }
      }

      if (2 <= arguments.length) {
        if (typeof arguments[1] === 'object') {           // for port.open(), verbatim
          this.options = arguments[1];
        } else if (typeof arguments[1] === 'number') {
          this.options.baudRate = arguments[1];
        } else {
          throw new TypeError('Unexpected second argument "' + arguments[1] + '"');
        }
      }

      try {
        if (filters) {
          if ('serial' in navigator) {
            this.port = await navigator.serial.requestPort({ filters: filters });
          } else if ('usb' in navigator) {
            this.port = await serial.requestPort({ filters: filters });
          }
        } else {
          // nothing to do if we got passed a SerialPort instance
        }
      } catch (error) {
        console.warn(error.message);
        this.port = null;
      }
    }

    /**
     * Opens this.port and read from it indefinitely.
     */
    async start() {
      if (!this.port) {
        console.error('No serial port selected.');
        return;
      }

      try {
        await this.port.open(this.options);
        console.log('Connected to serial port');
        this.keepReading = true;
      } catch (error) {
        let msg = error.message;
        if (msg === 'Failed to open serial port.') {
          msg += ' (The port might already be open in another tab or program, e.g. the Arduino Serial Monitor.)';
        }
        console.error(msg);
        return;
      }

      while (this.port.readable && this.keepReading) {
        this.reader = this.port.readable.getReader();
        this.writer = this.port.writable.getWriter();

        try {
          while (true) {
            let { value, done } = await this.reader.read();

            if (done) {
              await this.writer.ready;    // wait for any outstanding writes to finish
              this.writer.releaseLock();  // allow the serial port to be closed later
              this.reader.releaseLock();
              break;
            }

            if (value) {
              // take the most recent bytes if the newly-read buffer was
              // to instantly overflow the input buffer (unlikely)
              if (this.inBuf.byteLength < value.length) {
                value = new Uint8Array(value.buffer, value.byteOffset+value.length-this.inBuf.byteLength, this.inBuf.byteLength);
              }

              // discard the oldest parts of the input buffer on overflow
              if (this.inBuf.byteLength < this.inLen + value.length) {
                memcpy(this.inBuf, 0, this.inBuf, this.inLen+value.length-this.inBuf.byteLength, this.inBuf.byteLength-value.length);
                console.warn('Discarding the oldest ' + (this.inLen+value.length-this.inBuf.byteLength) + ' bytes of serial input data (you might want to read more frequently or increase the buffer via bufferSize())');
                this.inLen -= this.inLen+value.length-this.inBuf.byteLength;
              }

              // copy to the input buffer
              memcpy(this.inBuf, this.inLen, value, 0, value.length);
              this.inLen += value.length;
            }
          }
        } catch (error) {
          // if a non-fatal (e.g. framing) error occurs, continue w/ new Reader
          this.reader.releaseLock();
          console.warn(error.message);
        }
      }

      this.port.close();
      this.reader = null;
      console.log('Disconnected from serial port');
    }

    /**
     * Writes data to the serial port.
     * Note: when passing a number or an array of numbers, those need to be integers
     * and between 0 to 255.
     * @method write
     * @param {String|Number|Array of number|ArrayBuffer|TypedArray|DataView} out data to send
     * @return {Boolean} true if the port was open, false if not
     */
    async write(out) {
      let buffer;

      // check argument
      if (typeof out === 'string') {
        buffer = this.textEncoder.encode(out);
      } else if (typeof out === 'number' && Number.isInteger(out)) {
        if (out < 0 || 255 < out) {
          throw new TypeError('Write expects a number between 0 and 255 for sending it as a byte. To send any number as a sequence of digits instead, first convert it to a string before passing it to write().');
        }
        buffer = new Uint8Array([ out ]);
      } else if (Array.isArray(out)) {
        for (let i=0; i < out.length; i++) {
          if (typeof out[i] !== 'number' || !Number.isInteger(out[i]) ||
              out[i] < 0 || 255 < out[i]) {
                throw new TypeError('Array contained a value that wasn\'t an integer, or outside of 0 to 255');
          }
        }
        buffer = new Uint8Array(out);
      } else if (out instanceof ArrayBuffer || ArrayBuffer.isView(out)) {
        buffer = out;
      } else {
        throw new TypeError('Supported types are: String, Integer number (0 to 255), Array of integer numbers (0 to 255), ArrayBuffer, TypedArray or DataView');
      }

      if (!this.port || !this.port.writable) {
        console.warn('Serial port is not open, ignoring write');
        return false;
      }

      await this.writer.ready;  // wait for any outstanding writes to finish
      await this.writer.write(buffer);
      return true;
    }
  }


  /*
   * web-serial-polyfill, version 1.0.14
   * (c) Google LLC 2019
   * This section is covered by the Apache License, 2.0
   * https://github.com/google/web-serial-polyfill/
   */

  const kSetLineCoding = 0x20;
  const kSetControlLineState = 0x22;
  const kSendBreak = 0x23;
  const kDefaultBufferSize = 255;
  const kDefaultDataBits = 8;
  const kDefaultParity = 'none';
  const kDefaultStopBits = 1;
  const kAcceptableDataBits = [16, 8, 7, 6, 5];
  const kAcceptableStopBits = [1, 2];
  const kAcceptableParity = ['none', 'even', 'odd'];
  const kParityIndexMapping = ['none', 'odd', 'even'];
  const kStopBitsIndexMapping = [1, 1.5, 2];
  const kDefaultPolyfillOptions = {
      protocol: 'UsbCdcAcm',
      usbControlInterfaceClass: 2,
      usbTransferInterfaceClass: 10,
  };

  /**
   * Utility function to get the interface implementing a desired class.
   * @param {USBDevice} device The USB device.
   * @param {number} classCode The desired interface class.
   * @return {USBInterface} The first interface found that implements the desired
   * class.
   * @throws TypeError if no interface is found.
   */
  function findInterface(device, classCode) {
      const configuration = device.configurations[0];
      for (const iface of configuration.interfaces) {
          const alternate = iface.alternates[0];
          if (alternate.interfaceClass === classCode) {
              return iface;
          }
      }
      throw new TypeError(`Unable to find interface with class ${classCode}.`);
  }

  /**
   * Utility function to get an endpoint with a particular direction.
   * @param {USBInterface} iface The interface to search.
   * @param {USBDirection} direction The desired transfer direction.
   * @return {USBEndpoint} The first endpoint with the desired transfer direction.
   * @throws TypeError if no endpoint is found.
   */
  function findEndpoint(iface, direction) {
      const alternate = iface.alternates[0];
      for (const endpoint of alternate.endpoints) {
          if (endpoint.direction == direction) {
              return endpoint;
          }
      }
      throw new TypeError(`Interface ${iface.interfaceNumber} does not have an ` +
          `${direction} endpoint.`);
  }

  /**
   * Implementation of the underlying source API[1] which reads data from a USB
   * endpoint. This can be used to construct a ReadableStream.
   *
   * [1]: https://streams.spec.whatwg.org/#underlying-source-api
   */
  class UsbEndpointUnderlyingSource {
      /**
       * Constructs a new UnderlyingSource that will pull data from the specified
       * endpoint on the given USB device.
       *
       * @param {USBDevice} device
       * @param {USBEndpoint} endpoint
       * @param {function} onError function to be called on error
       */
      constructor(device, endpoint, onError) {
          this.type = 'bytes';
          this.device_ = device;
          this.endpoint_ = endpoint;
          this.onError_ = onError;
      }

      /**
       * Reads a chunk of data from the device.
       *
       * @param {ReadableByteStreamController} controller
       */
      pull(controller) {
          (async () => {
              var _a;
              let chunkSize;
              if (controller.desiredSize) {
                  const d = controller.desiredSize / this.endpoint_.packetSize;
                  chunkSize = Math.ceil(d) * this.endpoint_.packetSize;
              }
              else {
                  chunkSize = this.endpoint_.packetSize;
              }
              try {
                  const result = await this.device_.transferIn(this.endpoint_.endpointNumber, chunkSize);
                  if (result.status != 'ok') {
                      controller.error(`USB error: ${result.status}`);
                      this.onError_();
                  }
                  if ((_a = result.data) === null || _a === void 0 ? void 0 : _a.buffer) {
                      const chunk = new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength);
                      controller.enqueue(chunk);
                  }
              }
              catch (error) {
                  controller.error(error.toString());
                  this.onError_();
              }
          })();
      }
  }

  /**
   * Implementation of the underlying sink API[2] which writes data to a USB
   * endpoint. This can be used to construct a WritableStream.
   *
   * [2]: https://streams.spec.whatwg.org/#underlying-sink-api
   */
  class UsbEndpointUnderlyingSink {
      /**
       * Constructs a new UnderlyingSink that will write data to the specified
       * endpoint on the given USB device.
       *
       * @param {USBDevice} device
       * @param {USBEndpoint} endpoint
       * @param {function} onError function to be called on error
       */
      constructor(device, endpoint, onError) {
          this.device_ = device;
          this.endpoint_ = endpoint;
          this.onError_ = onError;
      }

      /**
       * Writes a chunk to the device.
       *
       * @param {Uint8Array} chunk
       * @param {WritableStreamDefaultController} controller
       */
      async write(chunk, controller) {
          try {
              const result = await this.device_.transferOut(this.endpoint_.endpointNumber, chunk);
              if (result.status != 'ok') {
                  controller.error(result.status);
                  this.onError_();
              }
          }
          catch (error) {
              controller.error(error.toString());
              this.onError_();
          }
      }
  }

  /** a class used to control serial devices over WebUSB */
  class SerialPort {
      /**
       * constructor taking a WebUSB device that creates a SerialPort instance.
       * @param {USBDevice} device A device acquired from the WebUSB API
       * @param {SerialPolyfillOptions} polyfillOptions Optional options to
       * configure the polyfill.
       */
      constructor(device, polyfillOptions) {
          this.polyfillOptions_ = Object.assign(Object.assign({}, kDefaultPolyfillOptions), polyfillOptions);
          this.outputSignals_ = {
              dataTerminalReady: false,
              requestToSend: false,
              break: false,
          };
          this.device_ = device;
          this.controlInterface_ = findInterface(this.device_, this.polyfillOptions_.usbControlInterfaceClass);
          this.transferInterface_ = findInterface(this.device_, this.polyfillOptions_.usbTransferInterfaceClass);
          this.inEndpoint_ = findEndpoint(this.transferInterface_, 'in');
          this.outEndpoint_ = findEndpoint(this.transferInterface_, 'out');
      }

      /**
       * Getter for the readable attribute. Constructs a new ReadableStream as
       * necessary.
       * @return {ReadableStream} the current readable stream
       */
      get readable() {
          var _a;
          if (!this.readable_ && this.device_.opened) {
              this.readable_ = new ReadableStream(new UsbEndpointUnderlyingSource(this.device_, this.inEndpoint_, () => {
                  this.readable_ = null;
              }), {
                  highWaterMark: (_a = this.serialOptions_.bufferSize) !== null && _a !== void 0 ? _a : kDefaultBufferSize,
              });
          }
          return this.readable_;
      }

      /**
       * Getter for the writable attribute. Constructs a new WritableStream as
       * necessary.
       * @return {WritableStream} the current writable stream
       */
      get writable() {
          var _a;
          if (!this.writable_ && this.device_.opened) {
              this.writable_ = new WritableStream(new UsbEndpointUnderlyingSink(this.device_, this.outEndpoint_, () => {
                  this.writable_ = null;
              }), new ByteLengthQueuingStrategy({
                  highWaterMark: (_a = this.serialOptions_.bufferSize) !== null && _a !== void 0 ? _a : kDefaultBufferSize,
              }));
          }
          return this.writable_;
      }

      /**
       * a function that opens the device and claims all interfaces needed to
       * control and communicate to and from the serial device
       * @param {SerialOptions} options Object containing serial options
       * @return {Promise<void>} A promise that will resolve when device is ready
       * for communication
       */
      async open(options) {
          this.serialOptions_ = options;
          this.validateOptions();
          try {
              await this.device_.open();
              if (this.device_.configuration === null) {
                  await this.device_.selectConfiguration(1);
              }
              await this.device_.claimInterface(this.controlInterface_.interfaceNumber);
              if (this.controlInterface_ !== this.transferInterface_) {
                  await this.device_.claimInterface(this.transferInterface_.interfaceNumber);
              }
              await this.setLineCoding();
              await this.setSignals({ dataTerminalReady: true });
          }
          catch (error) {
              if (this.device_.opened) {
                  await this.device_.close();
              }
              throw new Error('Error setting up device: ' + error.toString());
          }
      }

      /**
       * Closes the port.
       *
       * @return {Promise<void>} A promise that will resolve when the port is
       * closed.
       */
      async close() {
          const promises = [];
          if (this.readable_) {
              promises.push(this.readable_.cancel());
          }
          if (this.writable_) {
              promises.push(this.writable_.abort());
          }
          await Promise.all(promises);
          this.readable_ = null;
          this.writable_ = null;
          if (this.device_.opened) {
              await this.setSignals({ dataTerminalReady: false, requestToSend: false });
              await this.device_.close();
          }
      }

      /**
       * Forgets the port.
       *
       * @return {Promise<void>} A promise that will resolve when the port is
       * forgotten.
       */
      async forget() {
          return this.device_.forget();
      }

      /**
       * A function that returns properties of the device.
       * @return {SerialPortInfo} Device properties.
       */
      getInfo() {
          return {
              usbVendorId: this.device_.vendorId,
              usbProductId: this.device_.productId,
          };
      }

      /**
       * A function used to change the serial settings of the device
       * @param {object} options the object which carries serial settings data
       * @return {Promise<void>} A promise that will resolve when the options are
       * set
       */
      reconfigure(options) {
          this.serialOptions_ = Object.assign(Object.assign({}, this.serialOptions_), options);
          this.validateOptions();
          return this.setLineCoding();
      }

      /**
       * Sets control signal state for the port.
       * @param {SerialOutputSignals} signals The signals to enable or disable.
       * @return {Promise<void>} a promise that is resolved when the signal state
       * has been changed.
       */
      async setSignals(signals) {
          this.outputSignals_ = Object.assign(Object.assign({}, this.outputSignals_), signals);
          if (signals.dataTerminalReady !== undefined ||
              signals.requestToSend !== undefined) {
              // The Set_Control_Line_State command expects a bitmap containing the
              // values of all output signals that should be enabled or disabled.
              //
              // Ref: USB CDC specification version 1.1 §6.2.14.
              const value = (this.outputSignals_.dataTerminalReady ? 1 << 0 : 0) |
                  (this.outputSignals_.requestToSend ? 1 << 1 : 0);
              await this.device_.controlTransferOut({
                  'requestType': 'class',
                  'recipient': 'interface',
                  'request': kSetControlLineState,
                  'value': value,
                  'index': this.controlInterface_.interfaceNumber,
              });
          }
          if (signals.break !== undefined) {
              // The SendBreak command expects to be given a duration for how long the
              // break signal should be asserted. Passing 0xFFFF enables the signal
              // until 0x0000 is send.
              //
              // Ref: USB CDC specification version 1.1 §6.2.15.
              const value = this.outputSignals_.break ? 0xFFFF : 0x0000;
              await this.device_.controlTransferOut({
                  'requestType': 'class',
                  'recipient': 'interface',
                  'request': kSendBreak,
                  'value': value,
                  'index': this.controlInterface_.interfaceNumber,
              });
          }
      }

      /**
       * Checks the serial options for validity and throws an error if it is
       * not valid
       */
      validateOptions() {
          if (!this.isValidBaudRate(this.serialOptions_.baudRate)) {
              throw new RangeError('invalid Baud Rate ' + this.serialOptions_.baudRate);
          }
          if (!this.isValidDataBits(this.serialOptions_.dataBits)) {
              throw new RangeError('invalid dataBits ' + this.serialOptions_.dataBits);
          }
          if (!this.isValidStopBits(this.serialOptions_.stopBits)) {
              throw new RangeError('invalid stopBits ' + this.serialOptions_.stopBits);
          }
          if (!this.isValidParity(this.serialOptions_.parity)) {
              throw new RangeError('invalid parity ' + this.serialOptions_.parity);
          }
      }

      /**
       * Checks the baud rate for validity
       * @param {number} baudRate the baud rate to check
       * @return {boolean} A boolean that reflects whether the baud rate is valid
       */
      isValidBaudRate(baudRate) {
          return baudRate % 1 === 0;
      }

      /**
       * Checks the data bits for validity
       * @param {number} dataBits the data bits to check
       * @return {boolean} A boolean that reflects whether the data bits setting is
       * valid
       */
      isValidDataBits(dataBits) {
          if (typeof dataBits === 'undefined') {
              return true;
          }
          return kAcceptableDataBits.includes(dataBits);
      }

      /**
       * Checks the stop bits for validity
       * @param {number} stopBits the stop bits to check
       * @return {boolean} A boolean that reflects whether the stop bits setting is
       * valid
       */
      isValidStopBits(stopBits) {
          if (typeof stopBits === 'undefined') {
              return true;
          }
          return kAcceptableStopBits.includes(stopBits);
      }

      /**
       * Checks the parity for validity
       * @param {string} parity the parity to check
       * @return {boolean} A boolean that reflects whether the parity is valid
       */
      isValidParity(parity) {
          if (typeof parity === 'undefined') {
              return true;
          }
          return kAcceptableParity.includes(parity);
      }

      /**
       * sends the options alog the control interface to set them on the device
       * @return {Promise} a promise that will resolve when the options are set
       */
      async setLineCoding() {
          var _a, _b, _c;
          // Ref: USB CDC specification version 1.1 §6.2.12.
          const buffer = new ArrayBuffer(7);
          const view = new DataView(buffer);
          view.setUint32(0, this.serialOptions_.baudRate, true);
          view.setUint8(4, kStopBitsIndexMapping.indexOf((_a = this.serialOptions_.stopBits) !== null && _a !== void 0 ? _a : kDefaultStopBits));
          view.setUint8(5, kParityIndexMapping.indexOf((_b = this.serialOptions_.parity) !== null && _b !== void 0 ? _b : kDefaultParity));
          view.setUint8(6, (_c = this.serialOptions_.dataBits) !== null && _c !== void 0 ? _c : kDefaultDataBits);
          const result = await this.device_.controlTransferOut({
              'requestType': 'class',
              'recipient': 'interface',
              'request': kSetLineCoding,
              'value': 0x00,
              'index': this.controlInterface_.interfaceNumber,
          }, buffer);
          if (result.status != 'ok') {
              throw new DOMException('NetworkError', 'Failed to set line coding.');
          }
      }
  }

  /** implementation of the global navigator.serial object */
  class Serial {
      /**
       * Requests permission to access a new port.
       *
       * @param {SerialPortRequestOptions} options
       * @param {SerialPolyfillOptions} polyfillOptions
       * @return {Promise<SerialPort>}
       */
      async requestPort(options, polyfillOptions) {
          polyfillOptions = Object.assign(Object.assign({}, kDefaultPolyfillOptions), polyfillOptions);
          const usbFilters = [];
          if (options && options.filters) {
              for (const filter of options.filters) {
                  const usbFilter = {
                      classCode: polyfillOptions.usbControlInterfaceClass,
                  };
                  if (filter.usbVendorId !== undefined) {
                      usbFilter.vendorId = filter.usbVendorId;
                  }
                  if (filter.usbProductId !== undefined) {
                      usbFilter.productId = filter.usbProductId;
                  }
                  usbFilters.push(usbFilter);
              }
          }
          if (usbFilters.length === 0) {
              usbFilters.push({
                  classCode: polyfillOptions.usbControlInterfaceClass,
              });
          }
          const device = await navigator.usb.requestDevice({ 'filters': usbFilters });
          const port = new SerialPort(device, polyfillOptions);
          return port;
      }

      /**
       * Get the set of currently available ports.
       *
       * @param {SerialPolyfillOptions} polyfillOptions Polyfill configuration that
       * should be applied to these ports.
       * @return {Promise<SerialPort[]>} a promise that is resolved with a list of
       * ports.
       */
      async getPorts(polyfillOptions) {
          polyfillOptions = Object.assign(Object.assign({}, kDefaultPolyfillOptions), polyfillOptions);
          const devices = await navigator.usb.getDevices();
          const ports = [];
          devices.forEach((device) => {
              try {
                  const port = new SerialPort(device, polyfillOptions);
                  ports.push(port);
              }
              catch (e) {
                  // Skip unrecognized port.
              }
          });
          return ports;
      }
  }

  let serial = new Serial();


})();
