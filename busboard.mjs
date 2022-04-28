import fetch from "node-fetch";

//const response = await fetch("https://api.tfl.gov.uk/StopPoint/490008660N/Arrivals");
//const arrivals = await response.json;
//const fetch = require('node-fetch')

const arrivals  = fetch("https://api.tfl.gov.uk/StopPoint/490008660N/Arrivals")
    .then(response => response.json())
    .then(body => console.log(body));

    //arrivals.sort((a, b) => a.timeToStation - b.timeToStation);

    for (let i = 0; i < arrivals.length; i++) {
    const arrival = arrivals[i];
    console.log(`Bus to ${arrival.destinationName} arriving in ${arrival.timeToSation} seconds`);
}