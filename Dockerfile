# Stage 1: Install dependencies
FROM node:18-alpine AS deps
WORKDIR /app
# Copy only the files needed to install dependencies
COPY package.json pnpm-lock.yaml* ./
# Install dependencies for native module builds and pnpm
RUN apk update && apk add --no-cache python3 py3-pip build-base gcc && \
    npm i -g pnpm@latest && \
    pnpm install --frozen-lockfile
# Stage 2: Build the application
FROM node:18-alpine AS builder
WORKDIR /app
# Copy the installed node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules
# Copy the rest of the application files
COPY . .
# Install pnpm and build the application
RUN npm i -g pnpm@latest && \
    pnpm install --frozen-lockfile && \
    pnpm build
# Set NODE_ENV environment variable
ENV NODE_ENV production
# Re-run install only for production dependencies
RUN pnpm install --frozen-lockfile --prod
# Stage 3: Run the application
FROM node:18-alpine AS runner
WORKDIR /app
# Create the logs directory and give ownership to the node user
RUN mkdir -p /app/logs && chown -R node:node /app
# Copy the bundled code and production dependencies from the builder stage
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/src/modules/views ./dist/src/modules/views
# Use the node user from the image
USER node
# Expose application port (specify the ports your app uses)
EXPOSE 9000 9001 9002
# Start the server
CMD ["node", "dist/src/main.js"]
