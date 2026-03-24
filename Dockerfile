FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173 
# Vite usa el puerto 5173 por defecto, no el 3000
CMD ["npm", "run", "dev", "--", "--host"]