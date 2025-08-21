
const express = require('express') ;
const app = express();
const axios = require('axios');
const PORT = process.env.PORT || 3000;
const pg = require("pg") ;

const fs = require("fs");
// const url = 'https://api.upstox.com/v2/market-quote/ohlc';
const order_url = 'https://api.upstox.com/v2/order/place';
const url = "https://api.upstox.com/v2/market-quote/quotes?";
const ltp_url = "https://api.upstox.com/v2/market-quote/ltp?";
const token_url = 'https://api.upstox.com/v2/login/authorization/token';


// Initialize variables to hold high and low prices
let highPrice ;
let lowPrice ;
let stageOne;
let inorder = true; 

let highBroken = false; // Flag to track if high has broken in last 5-minute candle
let lowBroken = false; // Flag to track if low has broken in last 5-minute candle
let timeblock = false;
let prevtimeblock = false;
let bought = true;
let sold = false;

let ltpKey;
let count  = 0;

// REST CONTROLLERS AND CALLS

app.get("/", (req, res) => {   // Working Fine
    res.render("index.ejs");
})

app.get("/token", async(req,res)=>{   // Working Fine 
    res.render("callback.ejs");
    const code = req.query.code 
    const access = await fetchAuthToken(code)
    try {  

       update_data(access);
      
       
    } catch (error) {
        console.log(error.message)
    }

})

// USER ENTERED ESSENTIAL DATA
app.post('/submit', (req, res) => {
    highPrice = req.body.highprice;
    lowPrice = req.body.lowprice;
    //path = correctPathForJs(req.body.path);
  console.log('Parsed body:', req.body); 
  res.send('POST received!');
});

// CUSTOM FUNCTIONS UTIL
 async function correctPathForJs(){

 }


// DS To store Values
class Node {
    constructor(value) {
        this.value = value;
        this.next = null;
    }
}


// QUEUE BASED SEARCH ENGINE 

class Queue {
    constructor() {
        this.front = null;
        this.rear = null;
        this.size = 0;
    }

    enqueue(value) {
        const newNode = new Node(value);
        if (!this.front) {
            this.front = newNode;
            this.rear = newNode;
        } else {
            this.rear.next = newNode;
            this.rear = newNode;
        }
        this.size++;
    }

    dequeue() {
        if (!this.front) return null;
        const removedValue = this.front.value;
        if (this.front === this.rear) {
            this.front = null;
            this.rear = null;
        } else {
            this.front = this.front.next;
        }
        this.size--;
        return removedValue;
    }
    getsize(){
        return this.size;
    }
    traverse() {
        let currentNode = this.front;
        let highestValue = Number.NEGATIVE_INFINITY;
        let lowestValue = Number.POSITIVE_INFINITY;
        

        while (currentNode) {
            const currentValue = currentNode.value;
            if (currentValue > highestValue) {
                highestValue = currentValue;
            }
            if (currentValue < lowestValue) {
                lowestValue = currentValue;
            }
            currentNode = currentNode.next;
        }
          const arr =  [highestValue,lowestValue];
          
        // console.log("Highest value:", highestValue);
        // console.log("Lowest value:", lowestValue);
        return arr;
    }
}


// DB CALLS AND CONNECTIONS

//DATABASE CONNECTION

const db = new pg.Client({ 
user : "postgres",
host : "localhost",
database : "stocks",
password : "rohan",

port: 5432,
});

 db.connect();



// DB CALLS
// FILE LOAD IN DB

async function loadInstruments() {
  

  // 1. Create table if it doesn't exist
  await db.query(`
    CREATE TABLE IF NOT EXISTS instruments (
      instrument_key TEXT PRIMARY KEY,
      tradingsymbol TEXT,
      name TEXT,
      exchange TEXT,
      segment TEXT,
      instrument_type TEXT,
      isin TEXT,
      lot_size INT,
      tick_size FLOAT,
      exchange_token TEXT,
      security_type TEXT,
      short_name TEXT,
      freeze_quantity FLOAT
    );
  `);

  // 2. Read JSON file
  const rawData = fs.readFileSync("C:/Users/rohan/Desktop/UIK/complete.json");

  const data = JSON.parse(rawData);
  console.log(`Found ${data.length} instruments...`);

  // 3. Insert into DB
  const queryText = `
      INSERT INTO instruments 
      (instrument_key, tradingsymbol, name, exchange, segment, instrument_type, isin, lot_size, tick_size, exchange_token, security_type, short_name, freeze_quantity)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (instrument_key) DO UPDATE SET
        tradingsymbol = EXCLUDED.tradingsymbol,
        name = EXCLUDED.name,
        exchange = EXCLUDED.exchange,
        segment = EXCLUDED.segment,
        instrument_type = EXCLUDED.instrument_type,
        isin = EXCLUDED.isin,
        lot_size = EXCLUDED.lot_size,
        tick_size = EXCLUDED.tick_size,
        exchange_token = EXCLUDED.exchange_token,
        security_type = EXCLUDED.security_type,
        short_name = EXCLUDED.short_name,
        freeze_quantity = EXCLUDED.freeze_quantity;
    `;

  for (let item of data) {
    await db.query(queryText, [
      item.instrument_key,
      item.tradingsymbol,
      item.name,
      item.exchange,
      item.segment,
      item.instrument_type,
      item.isin,
      item.lot_size,
      item.tick_size,
      item.exchange_token,
      item.security_type,
      item.short_name,
      item.freeze_quantity,
    ]);
  }

  console.log(" All instruments loaded into Postgres");
  await db.end();
}

loadInstruments().catch(console.error);

//  DB CALL TO GET INSTRUMENT KEYS 
// TAKES LAST TRADING PRICE AND CALL OR PUT AS PARAMETERS

async function getInstrumentKey(ltp,cepe){  // Working fine
    ltp = ltp/100;
    ltp = Math.trunc(ltp);
    ltp = ltp *100

    if(cepe === "CE")ltp = ltp + 500 + "CE";
    if(cepe === "PE")ltp = ltp - 500 + "PE";
    let key = 'BANKNIFTY24403'
    let option = key + ltp ;
 const response = await db.query("SELECT instrument_key FROM public.stocks_table WHERE tradingsymbol = '"+ option + "'");
 console.log(response.rows[0].instrument_key);
 return response.rows[0].instrument_key
 }
//  async function test() {
//     let g = await getInstrumentKey(46000,"PE");
//  console.log(g);
//  }
//  test();





// AUTHENTICATION TOKEN UPSTOX

async function fetchAuthToken(code) {   //Working fine
    const token_headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      };
    const token_data = {
        'code': code,
       
        'redirect_uri': 'http://localhost:3000/token',
        'grant_type': code,

    };

    try {
        const response = await axios.post(token_url, new URLSearchParams(token_data), token_headers);
        return response.data.access_token; // Return the access token
    } catch (error) {
        throw new Error('Failed to fetch authentication token');
    }
}



// STRATEGY BLOCK

function checkBreak(lastPrice,access) {
    // If high price breaks, trigger buy function
    if(prevtimeblock && !timeblock && highBroken && !inorder){
        buy_order(lastPrice,"CE",access,'BUY');
        stageOne = lastPrice - (2/1000 * lastPrice);
           inorder = true;
           bought = true;
           count++;
    }
    if(prevtimeblock && !timeblock && lowBroken && !inorder){
        buy_order(lastPrice,"PE",access,'BUY');
        stageOne = lastPrice + (2/1000 * lastPrice);
           inorder = true;
           sold = true;
           count++;
    }

}


function getmin() {   // Works Fine
    const d = new Date(); // for now
    
    let m = d.getMinutes(); // =>  30

    console.log(m % 5);
    return m % 5;
}
// setInterval(() => {
//     let m = getmin();
// console.log("Interval",m);
// }, 1000);

function prevtimeb() {
    
    if(!prevtimeblock){
        let timeout = 60000;
        
    timeout = timeout * (10 - getmin())

        prevtimeblock = true;

        setTimeout(() => {
            prevtimeblock = false
        }, timeout);
    }
}

function timeb() {
    if(!timeblock){
        timeblock = true;
        let timeout = 60000;
        timeout = timeout * (5 - getmin())

        setTimeout(() => {
            timeblock = false
        }, timeout);
    }

}




// TRAILING STOP LOSS MECHANISM

async function sl_order(ltpKey,access) {
     //  const auth = 'Bearer ' + access;
        // console.log(auth);
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + access,
        };
       // const instrumentKey = await getInstrumentKey(ltp, cepe); // Wait for instrument key retrieval
        // console.log("instrument Key buy Order:- ","'"+instrumentKey+"'")
        const order_data = {
            quantity: 15,
            product: 'D',
            validity: 'DAY',
            price: 0,
            tag: 'string',
            instrument_token: ltpKey,
            order_type: 'MARKET',
            transaction_type: 'SELL',
            disclosed_quantity: 0,
            trigger_price: 0,
            is_amo: false,
          };
          try {  
        const response = await axios.post(order_url, order_data, { headers });
        console.log(response.data);
    } catch (error) {
        console.log('Error:', error.message);
    }
}


function stop_loss(ltp,access) {
    if(inorder){
        if(bought){
        let sl = (highPrice - ((3/1000)*highPrice))
        if(ltp <= sl || ltp <= stageOne){     
            sl_order(ltpKey,access)
            inorder = false;
            bought = false;
            
            console.log("Bought");
        }
    }else if(sold){
           let sl = ((3/1000 * lowPrice) + lowPrice);
            if(ltp >= sl || ltp >= stageOne){
            sl_order(ltpKey,access)
            inorder = false;
            sold = false;
            
            console.log("Sold");
            }
        }
    }
}

// QUEUE SEARCH ENGINE INITIALIZATION AND UPDATE

const queue = new Queue();


// Function to update high and low prices
function updateHighLow(lastPrice,access) {
    // Update high price if last price is higher
    if (lastPrice > highPrice) {
        // checkBreak(lastPrice);
        highPrice = lastPrice;
        highBroken = true;
        checkBreak(lastPrice,access);
        prevtimeb();
        timeb();
        console.log(`New high price: ${highPrice}`);
    }

    // Update low price if last price is lower
    if (lastPrice < lowPrice) {
        lowPrice = lastPrice;
        lowBroken = true;
        checkBreak(lastPrice,access);
        prevtimeb();
        timeb();
        console.log(`New low price: ${lowPrice}`);
    }
    if(queue.getsize() > 3750){
        queue.dequeue();
    [highPrice,lowPrice] = queue.traverse();
    }
    queue.enqueue(lastPrice);
    console.log("High Price",highPrice);
    console.log("Low Price",lowPrice);
    console.log("Number Of Orders",count);
  highBroken = false;
  lowBroken = false;
  stop_loss(lastPrice,access);
}

// API CALLS 

// API CALL TO FETCH DATA

async function fetchData(access){      // Working fine
    const auth = 'Bearer ' + access;
    // console.log("fetchdata :-",auth)
    const headers = {
        'Authorization': auth,
        'Accept': 'application/json',        
    }
    const params = {
        instrument_key: 'NSE_INDEX|Nifty Bank',
      
      };
      try {
  
        const response = await axios.get(ltp_url,{headers,params})
        
        // console.log(JSON.stringify(response.data))
        // console.log("================================")
        console.log("NEW DATA");
        //  console.log(response.data)
        let myobj = JSON.stringify(response.data)
        myobj = JSON.parse(myobj);
        
        // console.log("Open :- ",myobj.data["NSE_INDEX:Nifty Bank"].ohlc.open);
         console.log("LTP :- ",myobj.data["NSE_INDEX:Nifty Bank"].last_price);
        // console.log("TIME STAMP :- ",myobj.data["NSE_INDEX:Nifty Bank"].timestamp);
        // console.log("Current High Price",highPrice);
        // console.log("Current Low Price",lowPrice);
         let ltp = myobj.data["NSE_INDEX:Nifty Bank"].last_price
         
         updateHighLow(ltp,access);
         
        
    
    } catch (error) {
        console.log(error.message)
    }
}

// API CALLS TO UPDATE DATA EVERY 2 SECONDS LIMIT SET BY UPSTOX

function update_data(access){  // Working fine
    fetchData(access)
    setInterval(() => {
        fetchData(access);
    }, 2000);
} 


// SELL ORDER API CALL

async function sl_order(ltpKey,access) {
     //  const auth = 'Bearer ' + access;
        // console.log(auth);
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + access,
        };
       // const instrumentKey = await getInstrumentKey(ltp, cepe); // Wait for instrument key retrieval
        // console.log("instrument Key buy Order:- ","'"+instrumentKey+"'")
        const order_data = {
            quantity: 15,
            product: 'D',
            validity: 'DAY',
            price: 0,
            tag: 'string',
            instrument_token: ltpKey,
            order_type: 'MARKET',
            transaction_type: 'SELL',
            disclosed_quantity: 0,
            trigger_price: 0,
            is_amo: false,
          };
          try {  
        const response = await axios.post(order_url, order_data, { headers });
        console.log(response.data);
    } catch (error) {
        console.log('Error:', error.message);
    }
}

// BUY ORDER API CALL

async function buy_order(ltp, cepe, access,type) {  // Working fine works only in between market hours
    
      //  const auth = 'Bearer ' + access;
        // console.log(auth);
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + access,
        };
        const instrumentKey = await getInstrumentKey(ltp, cepe); // Wait for instrument key retrieval
        ltpKey = instrumentKey;
        // console.log("instrument Key buy Order:- ","'"+instrumentKey+"'")
        const order_data = {
            quantity: 15,
            product: 'D',
            validity: 'DAY',
            price: 0,
            tag: 'string',
            instrument_token: instrumentKey,
            order_type: 'MARKET',
            transaction_type: type,
            disclosed_quantity: 0,
            trigger_price: 0,
            is_amo: false,
          };
          try {  
        const response = await axios.post(order_url, order_data, { headers });
        console.log(response.data);
    } catch (error) {
        console.log('Error:', error.message);
    }
}



app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});