const AWS = require('aws-sdk');
const fetch = require('node-fetch');
const _ = require('lodash');
const config = require('config');
const md5 = require('md5');
const countryTelData = require('country-telephone-data');

const {
	WeBackAPI: {
		loginUrl,
		credentials: { username, password, country }
	}
} = config;

const getCountryCode = countryName => {
	const found = _.find(countryTelData.allCountries, obj => _.includes(obj.name, countryName));
	if (!_.isEmpty(found)) {
		return found.dialCode;
	}
	return -1;
};

(async () => {
	const weBackAPIurl = loginUrl;
	const weBackAPIbody = {
		Password: md5(password),
		User_Account: `+${getCountryCode(country)}-${username}`
	};
	console.log(weBackAPIbody);
	const resp = await fetch(weBackAPIurl, {
		method: 'POST',
		body: JSON.stringify(weBackAPIbody),
		headers: { 'Content-Type': 'application/json' }
	}).then(res => res.json());
	console.log(resp);
	const { Identity_Pool_Id, Token: token, Region_Info: region, Identity_Id } = resp;
	console.log();

	AWS.config.region = region;
	AWS.config.credentials = new AWS.CognitoIdentityCredentials({
		IdentityPoolId: Identity_Pool_Id, // your identity pool id here
		IdentityId: Identity_Id,
		Logins: {
			[`cognito-identity.amazonaws.com`]: token
		}
	});

	const lambda = new AWS.Lambda();
	const params = {
		FunctionName: 'Device_Manager_V2',
		InvocationType: 'RequestResponse',
		Payload: JSON.stringify({
			Device_Manager_Request: 'query',
			Identity_Id,
			Region_Info: region
		})
	};
	const lambdaResp = await new Promise((resolve, reject) => {
		lambda.invoke(params, (err, data) => {
			if (err) {
				console.log(err, err.stack);
				reject(err);
			} else {
				console.log(data);
				_.set(data, 'Payload', JSON.parse(data.Payload));
				resolve(data);
			}
		});
	});
	const { Payload } = lambdaResp;
	console.log(Payload);
})();
