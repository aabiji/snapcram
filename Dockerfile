FROM golang:1.24

WORKDIR /snapcram

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ .

EXPOSE 8080
CMD ["go", "run", "."]
