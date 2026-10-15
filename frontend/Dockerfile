FROM node:20-alpine AS build
WORKDIR /app
COPY package.json .npmrc ./
RUN npm install
COPY . .
# Empty = call the API on the same domain under /api (nginx below proxies it)
ARG REACT_APP_BACKEND_URL=
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
