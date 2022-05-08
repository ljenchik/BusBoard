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

let postcode;
let postcodeData;
let validLondonPostcode = false;

// Input and Validate postcode
while (!validLondonPostcode) {
    console.log("Please enter a postcode: ");
    postcode = readline.prompt();

    let postcodeResponse;
    // The Internet connection error
    try {
        postcodeResponse = await fetch(`https://api.postcodes.io/postcodes/${postcode}`);
    } catch (error) {
        logger.error(`Fetch failed attempting to access https://api.postcodes.io/postcodes/${postcode}`);
        console.error(`Fetch failed attempting to access https://api.postcodes.io/postcodes/${postcode}`);
        throw error;
    }
    // Invalid postcode
    try {
        if (!postcodeResponse.ok) {
            logger.error(`Fetch to https://api.postcodes.io/postcodes/${postcode} returned a non-success status code`);
            throw new Error(`Postcode ${postcode} is not valid`);
        }
    } catch (error) {
        logger.warn(`Asking user to re-enter postcode after non-success fetch`);
        console.log(`Postcode '${postcode}' is not valid. Please try again.`);
        continue;
    }
    postcodeData = await postcodeResponse.json();
    // Invalid London postcode
    try {
        if (postcodeData.result.region !== "London") {
            logger.error(`Postcode ${postcode} is not in London`);
            throw new Error(`Postcode ${postcode} is not in London`);
        }
    } catch (error) {
        logger.warn(`Asking user to re-enter postcode after non-London postcode`);
        console.log(`Postcode '${postcode}' is not in London. Please try again.`);
        continue;
    }
    validLondonPostcode = true;
} 

// Get bus stop latitude and longitude from postcode
const lat = postcodeData.result.latitude;
const long = postcodeData.result.longitude;

// Bus Stop (error if there is no bus stop in radius of 500m)
let busStopDetails;
try {
    const busStopsResponse = await fetch(`https://api.tfl.gov.uk/StopPoint/?lat=${lat}&lon=${long}&stopTypes=NaptanPublicBusCoachTram&radius=500`);
    busStopDetails = await busStopsResponse.json();
    if (busStopDetails.stopPoints.length === 0) {
        logger.error(`No buses nearby ${postcode}`);
        throw new Error ("No bus stops nearby.")
    }
} 
catch (err) {
    console.log(`There are no bus stops nearby ${postcode}`)
    throw err;
}

let closestTwo = busStopDetails.stopPoints.sort((a, b) => a.distance - b.distance).slice(0, 2);
console.log(closestTwo);

// Bus arrival times
var stopsAndArrivals = {};
let arrivalsResponse;

for (const stopPoint of closestTwo) {
    try {
        arrivalsResponse = await fetch(`https://api.tfl.gov.uk/StopPoint/${stopPoint.naptanId}/Arrivals`);
        if (!arrivalsResponse.ok) {
            throw new Error(`Response from https://api.tfl.gov.uk/StopPoint/${stopPoint.naptanId}/Arrivals returned a non-success status`);
        }
    } catch (error) {
        logger.error(`Fetch failed attempting to access https://api.tfl.gov.uk/StopPoint/${stopPoint.naptanId}/Arrivals`);
        console.error(`Fetch failed attempting to access https://api.tfl.gov.uk/StopPoint/${stopPoint.naptanId}/Arrivals`);
        throw error;
    }

    const arrivals = await arrivalsResponse.json();
    stopsAndArrivals[`${stopPoint.commonName}`] = [];
    if (arrivals.length === 0) {
        console.log(`No arrivals at stop ${stopPoint.commonName}`);
        logger.info(`No arrivals at stop ${stopPoint.commonName}`);
    } else {
        for (const arrival of arrivals.sort((a, b) => a.timeToStation - b.timeToStation).slice(0, 5)) {
            stopsAndArrivals[`${stopPoint.commonName}`].push(`    Bus ${arrival.lineName} to ${arrival.destinationName} arriving in ${
                formatDistanceToNow(
                    add(new Date(), { seconds: arrival.timeToStation }),
                    new Date(),
                    { includeSeconds: true }
                )
            }`);
        }
    }
} 

Object.entries(stopsAndArrivals).forEach(([key, value]) => {
    console.log(key);
    value.forEach(element => console.log(element));
  })

  console.log(`Do you need directions to ${Object.keys(stopsAndArrivals)[0]}? y/n`);
  const directionsReply = readline.prompt();
  if (directionsReply === 'y') {
    const directionsResponse = await fetch(`https://api.tfl.gov.uk/Journey/JourneyResults/${postcode}/to/${closestTwo[0].id}`);
    const directionsDetails = await directionsResponse.json();
    console.log(`Directions to ${directionsDetails.journeys[0].legs[0].arrivalPoint.commonName}`);
    const steps = directionsDetails.journeys[0].legs[0].instruction.steps;
    
    Object.entries(steps).forEach(([key, value]) => {
        key == 0 ? console.log(`${value.descriptionHeading} ${value.description}.`) : console.log(`${value.descriptionHeading} ${value.description}.`);
      })
  }