# Clone the OpenAPI projects
git clone https://github.com/tebexio/TebexCheckout-OpenAPI.git openapi/Checkout/
git clone https://github.com/tebexio/TebexHeadless-OpenAPI.git openapi/Headless/

# General dependency installation
npm install

# Ensure openapi generator is installed
npm install @openapitools/openapi-generator-cli

# Generate SDKs
npm run generate-sdks