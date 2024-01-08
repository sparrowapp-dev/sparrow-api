# Use the official Node.js 18 image as a base image
FROM node:18

# Install pnpm globally
RUN npm install -g pnpm

# Install pnpm globally
RUN npm install -g nodemon

# Set the working directory
WORKDIR /src

# Copy package.json and pnpm-lock.yaml to the working directory
COPY package.json .
COPY pnpm-lock.yaml .

# Install project dependencies
RUN pnpm install

# Copy the rest of the application code
COPY . .


EXPOSE 9000

# Specify the default command to run your application
CMD ["pnpm", "start:dev"]
