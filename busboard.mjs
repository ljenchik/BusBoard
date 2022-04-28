import fetch from "node-fetch";

// Postcode
let postcode = "RM142XA"
const postcodeResponse = await fetch(`http://api.postcodes.io/postcodes/${postcode}`); 
const postcodeDetails = await postcodeResponse.json();
const lat = postcodeDetails.result.latitude;
const lon = postcodeDetails.result.longitude;
//console.log(lat);
//console.log(lon);

// Bus Stops
const busStopResponse = await fetch(`https://api.tfl.gov.uk/StopPoint/?lat=${lat}&lon=${lon}&stopTypes=NaptanPublicBusCoachTram`);
const busStopDetails = await busStopResponse.json();
busStopDetails.stopPoints.sort((a, b) => a.distance - b.distance);
let nearestBusStops = [busStopDetails.stopPoints[0].id, busStopDetails.stopPoints[1].id]
//console.log(nearestBusStops);

// Bus arrivals

nearestBusStops.forEach(async busStop => {
    const response = await fetch(`https://api.tfl.gov.uk/StopPoint/${busStop}/Arrivals`);
    const arrivals = await response.json();
    arrivals.sort((a, b) => a.timeToStation - b.timeToStation);
    for (let i = 0; i < arrivals.length; i++) {
        const arrival = arrivals[i];
        console.log(`Bus ${arrival.lineName} to ${arrival.destinationName} arriving in ${arrival.timeToStation} seconds`);
    }
})


