# ./frontend/Dockerfile
# Use Node.js 20 LTS (or your desired version)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the frontend code
COPY . .

# Expose port 3000 for dev server
EXPOSE 3000

# Start development server
CMD ["npm", "start"]
