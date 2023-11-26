const express = require('express')
const app = express()

const cors = require('cors')
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const morgan = require('morgan')
const stripe = require('stripe') (process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000


//middleware
app.use(cors());
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cqpfzla.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const usersCollection = client.db('surveyDB').collection('users');
    const reviewCollection = client.db('surveyDB').collection('reviews');
    const surveyCollection = client.db('surveyDB').collection('surveys');
    const paymentCollection = client.db('surveyDB').collection('payments');

    
    //jwt related api
    app.post('/jwt', async(req, res) =>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn:'1h'});
        res.send({token});
    })

    // middleware
    const verifyToken = (req, res, next) =>{
      console.log('inside verifyToken',req.headers.authorization);
      if(!req.headers.authorization){
        return res.status(401).send({message: 'unauthorized access'});
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token,process.env.ACCESS_TOKEN_SECRET, (err, decoded) =>{
        if(err){
          return res.status(401).send({message: 'unauthorized access'})
        }
        req.decoded = decoded;
         next();
      })
    }
    // user verify after verifyToken
    const verifyAdmin = async (req, res, next) =>{
      const email = req.decoded.email;
      const query ={email: email};
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if(!isAdmin) {
        return res.status(403).send({message: 'forbidden access'})
      }
      next();
    }

    
    // users related api
    app.post('/users', async(req, res) =>{
      const user =req.body;
      const query = {email: user.email}
      const existingUser = await usersCollection.findOne(query)
      if(existingUser){
        return res.send({message: 'user already exists', insertedId: null})
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

    app.get('/users',verifyToken,verifyAdmin, async (req, res) =>{
      const result = await usersCollection.find().toArray()
      res.send(result);
    })

    // only  admin  email get
    app.get('/users/admin/:email', verifyToken, async(req, res) =>{
      const email =req.params.email;
      if(email !== req.decoded.email){
        return res.status(403).send({message: 'forbidden access'})
      }
      const query = {email : email};
      const user = await usersCollection.findOne(query)
      let admin = false;
      if(user){
        admin =user?.role === 'admin';
      }
      res.send({admin})
    })

    app.get('/users/surveyor/:email',verifyToken, async(req, res) =>{
      const email = req.params.email;
      if(email !== req.decoded.email){
        return res.status(403).send({message: 'unauthorized access'})
      }
      const query = {email: email};
      const user = await usersCollection.findOne(query);
      let surveyor = false;
      if(user){
        surveyor = user.role === 'surveyor';
      }
      res.send({surveyor});
    })

   // user role change by admin
    app.patch('/users/admin/:id',verifyToken, async(req, res) =>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          role: 'surveyor'
        }
      }
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    
    app.delete('/users/:id',verifyToken, verifyAdmin,  async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await usersCollection.deleteOne(query)
      res.send(result)
    })

    app.get('/reviews', async(req,res) =>{
      const result = await reviewCollection.find().toArray()
      res.send(result);
  })

   // create survey
   app.post('/survey',async(req, res) =>{
    const newSurvey = req.body;
    newSurvey.timestamp = new Date(); //creation date
    console.log(newSurvey);
    const result = await surveyCollection.insertOne(newSurvey)
    res.send(result)
   })
   
   app.get('/survey', async(req, res) =>{
    let query ={}
    if(req.query.email){
      query = {email: req.query.email}
     }
     const result = await surveyCollection.find(query).toArray()
     res.send(result);
   })


   // Generate client secret for stripe payment
   app.post('/create-payment-intent', verifyToken,async (req, res) =>{
    const {price} = req.body
    const amount = parseInt(price * 100)
    if(!price || amount < 1) return
    const {client_secret} = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      payment_method_types: ['card']
    })
    res.send({clientSecret: client_secret})
  })

  // save price info in price collection
  app.post('/payments',verifyToken, async(req, res) =>{
    const price = req.body
    const result = await paymentCollection.insertOne(price)
    res.send(result)
  })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) =>{
    res.send('Survey scribe is running')
})

app.listen(port,() =>{
    console.log(`Survey scribe is running on port ${port}`);
})


/*
<option value={id}>Name<option>
{ titile : ''sada", like:0, dislike : 0,}
*/