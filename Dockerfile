FROM node:20-bullseye-slim

WORKDIR /app

# Copy package dependency manifests
COPY package*.json ./

# Install npm dependencies
RUN npm install

# Copy all application files
COPY . .

# Build the React production assets using Vite
RUN npm run build

# Expose port 3030 as specified by user
EXPOSE 3030

# Start Express server with Node.js
CMD ["node", "server.js"]
