'use strict';

exports.handler = function handler(event, _context, callback) {
  const request = event.Records[0].cf.request;
  if (request.headers['x-websites-countries']) {
    const countryCode = request.headers['cloudfront-viewer-country'][0].value;
    console.log(`Headers CloudFront-Viewer-Country:${request.headers['cloudfront-viewer-country'][0].value},X-Websites-Countries:${request.headers['x-websites-countries'][0].value}, X-Websites-Prefix:'${request.headers['x-websites-countries-path'][0].value}'`);
    const countries = (request.headers['x-websites-countries'][0].value || '').split(',');
    const prefix = !request.headers['x-websites-countries-path'] ? countryCode + '/' : request.headers['x-websites-countries-path'][0].value;
    if (countries.includes(countryCode)) {
      request.origin.s3.path = prefix;
      console.log(`Forwarded to '${request.origin.s3.path}'`);
    }
  }
  callback(null, request);
}
