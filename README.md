<p align="center">
<a href="https://sparrows-newsletter.beehiiv.com/subscribe">
<img src="https://sparrowassets.blob.core.windows.net/publicassest/sparrow-logo.png" width="400" alt="logo"/>
</a>
</p>
 
<h1 align="center">
One-stop API management tool
</h1>
 
![TypeScript](https://img.shields.io/badge/-TypeScript-black?style=for-the-badge&logoColor=white&logo=typescript&color=2F73BF)
![Nest](https://img.shields.io/badge/-NestJs-black?style=for-the-badge&logo=nestjs&color=E0234D)
![Mongoose](https://img.shields.io/badge/-MongoDB-black?style=for-the-badge&logoColor=white&logo=mongodb&color=127237)
![Rust](https://img.shields.io/badge/-Rust-black?style=for-the-badge&logoColor=white&logo=rust&color=000000)
![Tauri](https://img.shields.io/badge/Tauri-FFC131?style=for-the-badge&logo=Tauri&logoColor=white)
![Svelte](https://img.shields.io/badge/Svelte-4A4A55?style=for-the-badge&logo=svelte&logoColor=FF3E00)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)
 
 
## 📋 Table of Contents
 
1. 🐦 [What is Sparrow ?](#what-is-sparrow)
2. 🔨 [Installation](#installation)
3. ❤️ [How to Contribute ?](#contributors)
4. 📨 [Subscribe to our Newsletter](#subscribe-to-our-newsletter)
5. ©️  [License](#license)
 
## <a name="what-is-sparrow">🐦 What is Sparrow ?</a>
 
Sparrow is your next go to API development buddy which can help you test, debug, distribute better APIs while collaborating with your colleagues and making you a better programmer.
 
## <a name="installation">🔨 Installation</a>
 
To install this project, you must have the following installed on your machine :

![Docker](https://img.shields.io/badge/-Docker-black?style=for-the-badge&logoColor=white&logo=docker&color=2496ED)
![NODE](https://img.shields.io/badge/-Node.js-black?style=for-the-badge&logoColor=white&logo=nodedotjs&color=339933)
![NPM](https://img.shields.io/badge/-NPM-black?style=for-the-badge&logoColor=white&logo=npm&color=CB3837)

### Prerequisite:

```bash
# Clone the repository
git clone https://github.com/sparrowapp-dev/sparrow-api.git

# Move into the project directory
cd sparrow-api

# Install PNPM globally
npm i -g pnpm

# Tweak environment variables in .env.example by following the below mentioned guide
[Environment Variables](./docs/ENV.md)

# Create .env file from the tweaked .env.example file
cp .env.example .env
```

### Docker Method

- To install all services(mongo + api server) as docker containers, run:

  `pnpm docker:up `

- To install individual services, run:

        pnpm docker:<SERVICE NAME>

  - `pnpm docker:mongo` - Runs only mongo in a docker container
  - `pnpm docker:api` - Runs only the api server

### Non-Docker Method

```bash
# Install dependencies
	pnpm i

# Run App in development mode
	pnpm start:dev
```

### Access swagger on localhost:

Go to http://localhost:{PORT}/api/docs

### Default User for Login:

Sparrow creates a default user to help you get started quickly and easily.

**Login Credentials:**

- **Email:** dev@sparrow.com
- **Password:** 12345678@

### [OPTIONAL] In case you want to remove the docker services, run the following command:

`pnpm docker:down`

## <a name="contributors">❤️ How to Contribue ?</a>

You can checkout [Contributing Guidelines](./docs/CONTRIBUTING.md)

## <a name="subscribe-to-our-newsletter">📨 Newsletter</a>

Subscribe to our newsletter by applying [here!](https://sparrows-newsletter.beehiiv.com/subscribe)

## <a name="license">©️ License</a>

Sparrow comes under the GNU AFFERO GENERAL PUBLIC LICENSE. For more information, you can checkout [LICENSE](./LICENSE)
