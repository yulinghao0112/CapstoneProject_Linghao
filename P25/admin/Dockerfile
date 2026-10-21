FROM node:18 AS build
WORKDIR /app
COPY package.json yarn.lock* /app/
RUN yarn install
RUN yarn add cross-env@^7
COPY . /app
RUN yarn build   # CRA: 输出到 build; Vite: 输出到 dist


FROM nginx:1.27-alpine
COPY --from=build /app/build /usr/share/nginx/html


COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]