import fetch from "node-fetch";
import readline from "readline-sync";
import winston from 'winston';
import { add, formatDistanceToNow } from "date-fns";

// Logging errors
const { combine, timestamp, printf, align} = winston.format;
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({
      format: 'YYYY-MM-DD hh:mm:ss A',
    }),
    align(),
    printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
  ),
  transports: [new winston.transports.Console(), new winston.transports.File({ filename: 'combined.log' })],
});

// Input postcode
console.log("Please enter a postcode: ");
let postcode = readline.prompt();
postcode = postcode.replace(/\s/g, "")

// Validate postcode
let validLondonPostcode = false
while (!validLondonPostcode) {
    let postcodeResponse;
    try {
        postcodeResponse = await fetch(`https://api.postcodes.io/postcodes/${postcode}`);
    } catch (error) {
        logger.error(`Fetch failed attempting to access https://api.postcodes.io/postcodes/${postcode}`);
        console.error(`Fetch failed attempting to access https://api.postcodes.io/postcodes/${postcode}`);
        throw error;
    }

    try {
        postcodeResponse = await fetch(`https://api.postcodes.io/postcodes/${postcode}/validate`);
        const validPostcodeResponse = await postcodeResponse.json();
        if (!validPostcodeResponse.result) {
            logger.error(`Invalid postcode: ${postcode}`);
            throw new Error ("Invalid postcode")
        }
        validLondonPostcode = true
    } 
    catch (err) {
        console.log("Invalid postcode, try again")
        console.log("Please enter a valid postcode: ");
        postcode = readline.prompt();
        postcode = postcode.replace(/\s/g, "")
    }
} 

// Get bus stop latitude and longitude from postcode
const postcodeResponse = await fetch(`https://api.postcodes.io/postcodes/${postcode}`);
const postcodeDetails = await postcodeResponse.json();
const lat = postcodeDetails.result.latitude;
const long = postcodeDetails.result.longitude;

// Bus Stop (error if there is no bus stop in radius of 500m)
let busStopDetails;
try {
    const busStopResponse = await fetch(`https://api.tfl.gov.uk/StopPoint/?lat=${lat}&lon=${long}&stopTypes=NaptanPublicBusCoachTram&radius=500`);
    busStopDetails = await busStopResponse.json();
    if (busStopDetails.stopPoints.length === 0) {
        logger.error(`No buses nearby ${postcode}`);
        throw new Error ("No bus stops nearby.")
    }
} 
catch (err) {
    console.log(`There are no bus stops nearby ${postcode}`)
    throw err;
}

busStopDetails.stopPoints.sort((a, b) => a.distance - b.distance);

// Bus arrival times
var stopsAndArrivals = {};

for (let j = 0; j < 2; j ++) {
    let stopCode = (busStopDetails.stopPoints[j].id);
    const response = await fetch(`https://api.tfl.gov.uk/StopPoint/${stopCode}/Arrivals`);
    const arrivals = await response.json();
    arrivals.sort((a, b) => a.timeToStation - b.timeToStation);
    stopsAndArrivals[`${busStopDetails.stopPoints[j].commonName}, ${stopCode}`] = [];

    for (let i = 0; i < arrivals.length; i++) {
        const arrival = arrivals[i];
        stopsAndArrivals[`${busStopDetails.stopPoints[j].commonName}, ${stopCode}`].push(`       Bus ${arrival.lineName} to 
        ${arrival.destinationName} arriving in ${
            formatDistanceToNow(
                add(new Date(), { seconds: arrival.timeToStation }),
                new Date(),
                { includeSeconds: true }
            )
        }`);
    }
} 

const noArrivals = Object.entries(stopsAndArrivals).every(([key, value]) => value.length === 0);

try {
    if (noArrivals) {
        throw new Error ("No buses coming");
    }
}
catch (err) {
    logger.error(`No buses arriving near ${postcode}`);
    console.log("\nThere are no buses arriving.");
    throw err.message;
}


Object.entries(stopsAndArrivals).forEach(([key, value]) => {
    console.log(key);
    value.forEach(element => console.log(element));
  })


  console.log(`Do you need directions to ${Object.keys(stopsAndArrivals)[0]}? y/n`);
  const directionsResponse = readline.prompt();
  if (directionsResponse === 'y') {
    const directionsResponse = await fetch(`https://api.tfl.gov.uk/Journey/JourneyResults/${postcode}/to/${busStopDetails.stopPoints[0].id}`);
    const directionsDetails = await directionsResponse.json();
    const steps = directionsDetails.journeys[0].legs[0].instruction.steps;
    Object.entries(steps).forEach(([key, value]) => {
        key == 0 ? console.log(`Continue ${value.skyDirectionDescription.toLowerCase()} along ${value.description}.`) : console.log(`${value.descriptionHeading} ${value.description}.`);
      })
  }

function timeUnits(time) {
    if (time === 1) {
        return time + " second";
    } else if (time < 60) {
        return time + " seconds";
    } else if (time < 120) {
        return Math.floor(time/60) + " minute";
    } else {
        return Math.floor(time/60) + " minutes";
    }
}