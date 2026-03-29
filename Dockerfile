FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 7860
ENV PORT=7860
CMD ["node", "server.js"]