FROM node:18-alpine AS deps
WORKDIR /app

# Add build argument for GitHub token
ARG GITHUB_TOKEN

# Configure npm and pnpm to use GitHub token
RUN echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" > .npmrc
RUN echo "@sparrowapp-dev:registry=https://npm.pkg.github.com" >> .npmrc
RUN echo "always-auth=true" >> .npmrc

# Copy only the files needed to install dependencies
COPY package.json pnpm-lock.yaml* ./

# Install dependencies for native module builds
RUN apk update && apk add --no-cache python3 py3-pip build-base gcc

# Install dependencies with the preferred package manager
RUN npm i -g pnpm@latest
RUN pnpm install --frozen-lockfile
RUN pnpm add @sparrowapp-dev/stripe-billing@1.0.0
# RUN corepack enable pnpm && pnpm i --frozen-lockfile

FROM node:18-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the files
COPY . .

# Run build with the preferred package manager
# RUN corepack enable pnpm && pnpm build
RUN npm i -g pnpm@latest
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Set NODE_ENV environment variable
ENV NODE_ENV production

# Re-run install only for production dependencies
# RUN corepack enable pnpm && pnpm i --frozen-lockfile --prod
RUN pnpm install --frozen-lockfile --prod

FROM node:18-alpine AS runner
WORKDIR /app

# Create the logs directory and give ownership to the node user
RUN mkdir -p /app/logs && chown -R node:node /app

# Copy the bundled code from the builder stage
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/src/modules/views ./dist/src/modules/views

# Use the node user from the image
USER node

# Expose application port (optional, specify the port your app uses)
EXPOSE 9000 9001 9002

# Start the server
CMD ["node", "dist/src/main.js"]