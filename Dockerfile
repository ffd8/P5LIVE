FROM node:20-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps
COPY . .
EXPOSE 5001

CMD ["npm", "run", "start"]
