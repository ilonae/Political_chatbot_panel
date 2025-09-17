FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Start React in dev mode
CMD ["npm", "start"]
