FROM node:12
WORKDIR /usr/src/app
COPY package*.json ./

RUN npm install
COPY . .
EXPOSE 7770
CMD [ "npm", "run", "prodstart" ]
