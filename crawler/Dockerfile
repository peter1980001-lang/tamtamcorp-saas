FROM mcr.microsoft.com/playwright:v1.48.2-jammy

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

ENV HOST=0.0.0.0
ENV PORT=8787

EXPOSE 8787
CMD ["npm", "run", "start"]
