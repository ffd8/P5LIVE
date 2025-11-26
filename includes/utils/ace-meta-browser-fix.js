document.addEventListener("DOMContentLoaded", function () {
  if (!navigator.userAgent.includes("OculusBrowser")){
    return;
  }
  
  console.log("Applying Oculus Browser Editor Fix");

  Array.from(document.querySelectorAll("textarea.ace_text-input")).forEach(
    (el) => {
      el.style.fontSize = "32px";
      el.style.minHeight = "32px";
      el.style.minWidth = "100px";
      el.style.opacity = "0.01";
    },
  );
});
