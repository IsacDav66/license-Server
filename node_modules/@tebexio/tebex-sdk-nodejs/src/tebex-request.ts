const request = require('@cypress/request');

/**
 * Handles HTTP requests using the `@cypress/request` library as a secure alternative to the `requests` package included with
 * the generated OpenAPI projects.
 *
 * Allows performing HTTP actions (e.g., GET, POST, PUT, DELETE) with essential request configuration.
 *
 * Authorization is automatically applied based on the destination URI.
 *
 * @param incomingRequestOptions - The options object containing HTTP request configuration.
 * @param incomingRequestOptions.method - The HTTP method to use (e.g., GET, POST).
 * @param incomingRequestOptions.uri - The endpoint or URI for the request.
 * @param incomingRequestOptions.headers - An optional object of HTTP headers to include in the request.
 * @param incomingRequestOptions.qs - An optional object for query string parameters.
 * @param incomingRequestOptions.useQuerystring - If true, includes `qs` in query string formatting.
 * @param incomingRequestOptions.json - Whether the request should send/receive JSON data.
 * @param incomingRequestOptions.body - An optional body or payload to send with the request (for POST, PUT, etc.).
 * @param callback - A callback function that will receive the results of the HTTP request.
 *
 * @example
 * const requestOptions = {
 *     method: 'GET',
 *     uri: 'https://api.example.com/v1/data',
 *     headers: { 'Authorization': 'Bearer <token>' },
 *     useQuerystring: true,
 *     qs: { param: 'value' },
 *     json: true,
 * };
 *
 * localVarRequest(requestOptions, (error, response, body) => {
 *     if (error) {
 *         console.error('Error occurred:', error);
 *     } else {
 *         console.log('Response:', response);
 *         console.log('Body:', body);
 *     }
 * });
 */
export function localVarRequest(incomingRequestOptions: {
    method: string;
    qs: any;
    headers: any;
    uri: string;
    useQuerystring: boolean;
    json: boolean;
    body: any;
} | any, callback: (error: any, response: any, body: any) => void) {
    const requestOptions = {
        auth: incomingRequestOptions.auth,
        method: incomingRequestOptions.method,
        uri: incomingRequestOptions.uri,
        headers: incomingRequestOptions.headers || {},
        json: incomingRequestOptions.json === true,
        qs: incomingRequestOptions.qs,
        body: incomingRequestOptions.body,
    };

    if (incomingRequestOptions.useQuerystring && incomingRequestOptions.qs) {
        requestOptions.qs = incomingRequestOptions.qs;
    }

    // Add body if provided
    if (incomingRequestOptions.body !== undefined) {
        requestOptions.body = incomingRequestOptions.body;
    }

    // Use cypress request library to complete the request as needed
    request(requestOptions, (error:any, response:any, body:any) => {
        // Invoke the provided callback with the results
        callback(error, response, body);
    });
}