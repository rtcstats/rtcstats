# docker build -t rtcstats-server -f Dockerfile .
# docker run -p 8080:8080 rtcstats-server
# See also: https://www.docker.com/blog/getting-started-with-docker-using-node-jspart-i/
# Configuration can be passed via environment variables, e.g.
# docker run -p 8080:8071 -e NODE_CONFIG='{"server": {"httpPort":8071}}' rtcstats-server
FROM node:22-alpine

WORKDIR /server
COPY package.json .

# Copy shared and server / packages.
WORKDIR /server/packages/rtcstats-shared
COPY packages/rtcstats-shared .

WORKDIR /server/packages/rtcstats-server
COPY packages/rtcstats-server .

WORKDIR /server
# Install once to seed. Starting will install again!
RUN npm install

# TODO: download supabase crt
# https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

ENTRYPOINT ["npm"]
# start MUST run npm install again to refresh the symbolic links
CMD ["start", "--workspace=packages/rtcstats-server"]
