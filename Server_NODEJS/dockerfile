# Use the official Node.js image as a base
FROM node:24-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the source code to the working directory
COPY . .

# Expose the port the application runs on
EXPOSE 5000

# Define the command to run the application
CMD ["node", "server.js"]