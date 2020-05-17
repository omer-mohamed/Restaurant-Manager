//Requiring the dependencies
const express = require('express');
const app = express();
const mc = require("mongodb").MongoClient;
const ObjectID = require('mongodb').ObjectID;
let db;
const session = require('express-session')
//creating a new store called a4
const MongoDBStore = require('connect-mongodb-session')(session);

const store = new MongoDBStore({
  uri: 'mongodb://localhost:27017/a4',
  collection: 'sessions'
});
app.use(session({ secret: 'some secret here', store: store }))
//sets the template to pug
app.set("view engine", "pug");

//sets the routes
app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use(express.static("public"));


//Method Handelers\\

//********** GET requests*************\\

//get method handler for the home page
//sends renders the header based on if the user is logged in or not
app.get('/', function(req, res,next){
  res.render('pages/home',{loginFlag: req.session.loggedIn});
});

//renders the order page if the user asing for the order is logged in
app.get("/order", function(req, res,next){
  if(req.session.loggedIn == true){
    res.sendFile("/public/orderform.html", { root: __dirname });
  }
  else{
    res.status(401).send("Not authorized. You must be log in to make an order ");
  }
});

//sending the registration page
app.get("/register",function(req, res){
  res.sendFile("public/register.html",{root:__dirname});
});

//sending the login page
app.get("/login",function(req, res){
  res.sendFile("public/login.html",{root:__dirname});
});

//logout get handler sets the loggedIn to false and the username set to null
app.get("/logout", function(req, res, next){
	req.session.loggedIn = false;
  req.session.username = null;
	res.redirect("/");
});

//get handeler to list out the users
app.get('/users', function(req, res,next){
  //checks if there is a query specified by the user
  if(req.query.name !==undefined){
    let query = req.query.name.toLowerCase();
    //checks for the users with the specified query and privacy set to false
    db.collection("users").find({ "privacy": false, 'username': {'$regex': query} }).toArray(function(err, result){
      if(err){
        res.status(500).send("Error reading database.");
        return;
      }
      //renders the page
      res.status(200).render('pages/users',{users:result,loginFlag: req.session.loggedIn});
    });
  }
  else{
    //lists all the users whose privacy is set to false
    db.collection("users").find({ "privacy": false }).toArray(function(err, result){
      if(err){
        res.status(500).send("Error reading database.");
        return;
      }
      //renders the page
      res.status(200).render('pages/users',{users:result,loginFlag: req.session.loggedIn});
    });
  }
});

//get handeler for /profile
app.get("/profile",sendUserID);
//get handeler for the specific user
app.get("/users/:uid",sendUser);

//this function redirects the user to their own profile  by finding that specific user
function sendUserID(req,res,next){
  let username = req.session.username;
  db.collection("users").findOne({"username": username}, function(err, result){
    if(err){throw err;}
    res.redirect('/users/'+result._id);
  });
}

//this function gets called when a specific user is called using the params provided
function sendUser(req,res,next){
  let id=req.params.uid;
  let oid;
  let flag = false;
  try{
    oid = new ObjectID(id);
  }
  catch{
    res.status(404).send("That ID does not exist.");
    return;
  }
  //searches for the user with that ID
  db.collection("users").findOne({"_id": oid}, function(err, result){
    if(err){
      res.status(500).send("Error reading database.");
      return;
    }
    if(!result){
      res.status(404).send("That ID does not exist in the database.");
      return;
    }
    //checks if the user is privact and not logged in then throws a 403 error
    if(result.privacy&& req.session.username != result.username){
      res.status(403).send("The only person who can view this private profile is the owner of the profile");
    }
    else{
      //if the user is logged in
      if(req.session.username == result.username){
        //checks if the user is logged in sends a loggedIN flag is true
        if(req.session.loggedIn == true){
          flag = true;
          res.status(200).render('pages/profile',{loginflag:flag,data:result});
        }
        else{
          flag = false;
          res.status(200).render('pages/profile',{loginflag:flag,data:result});
        }
      }
      else{
        if(req.session.loggedIn == true){
          flag = false;
          res.status(200).render('pages/profile',{loginflag:flag,data:result});
        }
        else{
          flag = false;
          res.status(200).render('pages/profile',{loginflag:flag,data:result});
        }
      }
    }
  });
}

//handles the specific order by finding the specific order id in the suer databse
app.get("/orders/:oid",function(req,res,next){
  let id = req.params.oid;
  let oid;
  try{
    oid = new ObjectID(id);
  }
  catch {
    res.status(404).send("That ID does not exist.");
    return;
  }
  //goes through the database and finds the user with the specific order id provided
  db.collection("users").findOne({"orders": {$elemMatch: {"_id":oid}}}, function(err, result){
    if (err) {throw err;}
    //checks if its not private and is logged in
    if(result.privacy == false && req.session.username==result.username){
      //goes through the orders and checks for the IDs
      for(let i=0;i<result.orders.length;i++){
        if(String(oid) === String(result.orders[i]._id)){
          res.status(200).render('pages/orderSummary',{username:result.username,data:result.orders[i]});
        }
      }
    }
    else if(result.privacy == true && req.session.username==result.username){
      //goes through the orders and checks for the IDs
      for(let i=0;i<result.orders.length;i++){
        if(String(oid) === String(result.orders[i]._id)){
          res.status(200).render('pages/orderSummary',{username:result.username,data:result.orders[i]});
        }
      }
    }
    else{
      res.status(404).send("You are not allowed to view this page");
    }
  });
});


//********** POST requests*************\\

//register a new users
//takes in the response from the register.html and adds the user to the databse
app.post("/register", function(req, res, next){
	let username = req.body.username.toLowerCase();
	let password = req.body.password;
  //checks if the user is already in the database sends a 401 error
  db.collection("users").findOne({"username":username}, function(err, result){
    if(err){
      res.status(500).send("Error reading database.");
      return;
    }
    if(result){
      res.status(401).send();
      return;
    }
    else{
      let newUser = {};
      newUser._id = new ObjectID();
      newUser.username = username;
      newUser.password = password;
      newUser.privacy = false;
      req.session.loggedIn = true;
      req.session.username = username;
      //inserts the user in the database
      db.collection("users").insertOne(newUser,function(err,result){
        if(err){
    			res.status(500).send("Error saving to database.");
    			return;
    		}
        else{
          res.status(200).send("/users/"+newUser._id.toString());
        }
      });
    }
  });
});

//login
//gets the login data from the login.html
app.post("/login", function(req, res, next){
  //if the user is already logged in and redirects them home
	if(req.session.loggedIn){
		res.redirect("/");
		return;
	}
	let username = req.body.username.toLowerCase();
	let password = req.body.password;
  //goes through the database to fin d the user and set the loggedin flag to true and the username to the user
	db.collection("users").findOne({"username":username,"password":password}, function(err, result){
		if(err) throw err;
		if(result){
			req.session.loggedIn = true;
			req.session.username = username;
			res.redirect("/");
		}else{
			res.status(401).send("Not authorized. Invalid username.");
			return;
		}
	});
});

//adds an order to the specific user
app.post("/orders", function(req, res, next) {
    let order = req.body;
    order._id = new ObjectID();
    //creates a new order id and adds the whole order to the user database
    db.collection("users").findOneAndUpdate({ "username": req.session.username }, { $push: { "orders": order}}, function(err, result) {
        if (err) {
            throw err;
        }
        res.status(200).send();
    });
});

//***PUT METHOD***\\

//this method sets the privacy to true or false
app.put("/users/:uid", function(req, res, next){
  let id = req.params.uid;
  let oid;
  let privacyFlag = false;

  if(req.body.privacy == "true"){
    privacyFlag = true;
  }
  try{
    oid = new ObjectID(id);
  }
  catch{
    res.status(404).send("That ID does not exist.");
    return;
  }
  //checks if the user loggedin is the user making the changes
  if(req.body.currUser != req.session.username){
    res.status(403).send("The only person who can view this private profile is the owner of the profile");
  }
  else{
    //sets the privacy depending to what the user wants
    db.collection("users").updateOne({ "username": req.session.username }, { $set: { "privacy": privacyFlag } }, function(err, result) {
      if (err) throw err;
      res.status(200).send();
    });
  }
});

//***********Setting up the database*******\\
mc.connect("mongodb://localhost:27017", function(err, client) {
	if (err) {
		console.log("Error in connecting to database");
		console.log(err);
		return;
	}

	//Set the app.locals.db variale to be the 'data' database
	db = client.db("a4");
	app.listen(3000);
	console.log("Server listening on port 3000");
})
