const express = require("express");
const bcrypt=require('bcrypt');
//bring user type model
const UserTypes = require("../model/UserTypes"); 
// bring user model
const User = require("../model/User");
const Course = require("../model/Batch");
const qr=require('../model/qrcode');
const crypto = require('crypto');
const async = require('async');
const library = require('../model/lib_tmp');
var inventory = require('../model/sportsinventory_model');
var nodemailer=require('nodemailer');

const userRouter = express.Router();

//User type ids
//1 admin
//2 Gate
//3 SAC
//4 Lib
//5 student 
userRouter.get("/logout",function (req,res) {
	res.clearCookie('remember_me');
	req.logOut();

	res.redirect("/"); //sending to website home page
})

// check if logged in 
var loggedin = function (req,res,next)
{
	if(req.isAuthenticated()){
		next() // if logged in
	}
	else if(req.cookies['remember_me']){
		req.user = req.cookies['remember_me'];
		next();
	}
	else{
		//console.log("looping....");
		res.redirect('/');
	}
}

userRouter.get("/myProfile",loggedin,(req,res)=>{

		res.render("myProfile",{
			title: "My Profile",
			data: req.user,
			id: req.user.userTypeId
		})

})
userRouter.get("/loadHomePage",loggedin, (req,res)=>{
	//res.send req.session
	//console.log(req.user);
	//console.log(req.user);
	let user = req.user;
	let userType= user.userTypeId;
	if(userType==1){
	
	res.redirect("/admin");
	}
	else if(userType==2)
	{
		res.render('GateViews/GateScanQR',{
			title:user.fName + user.lName,
			route: "gate",
		});
	}
	else if(userType==3)
	{
       // localStorage.setItem('user_id',req.user._id);
		res.redirect('/equipment');
	}
	else if(userType==4)
	{
		res.redirect('/lib_tmp');
	}
	else if(userType==5)
	{
		res.redirect('/student_homepage1');
	}
})





userRouter.get('/reset/:token',(req,res)=>{
	User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
		if (!user) {
		  req.flash('error', 'Password reset token is invalid or has expired.');
		  return res.redirect('/forgot');
		}
		res.render('resetPassword', {
		  user: req.user,
		  token: req.params.token
		});
	  });
})

userRouter.post('/reset/:token', (req,res) =>{

	async.waterfall([
		function(done) {
		  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, async function(err, user) {
			if (!user) {
			  req.flash('error', 'Password reset token is invalid or has expired.');
			  return res.redirect('/');
			}
			const hashedPass = await bcrypt.hash(req.body.newPassword,10);
			user.password = hashedPass;
			user.resetPasswordToken = undefined;
			user.resetPasswordExpires = undefined;
	
			user.save(function(err) {
			  req.logIn(user, function(err) {
				done(err, user);
			  });
			});
		  });
		},
		function(user, done) {
		  var smtpTransport = nodemailer.createTransport({
			service: 'gmail',
			auth: {
				user: process.env.mailID,
				pass: process.env.mailPassword	
			}
		  });
		  var mailOptions = {
			to: user.userEmailId,
			from: process.env.mailID,
			subject: 'Your password has been changed',
			text: 'Hello,\n\n' +
			  'This is a confirmation that the password for your DA Scanner account ' + user.userEmailId + ' has just been changed.\n'
		  };
		  smtpTransport.sendMail(mailOptions, function(err) {
			req.flash('success', 'Success! Your password has been changed.');
			done(err);
		  });
		}
	  ], function(err) {
		res.redirect('/');
	  });

})




userRouter.get('/forgotPass',(req,res)=>{

		res.render('forgotPassword',{
			user:req.user,
			error: req.flash('error'),
			info: req.flash('info')
		});

})
/*
userRouter.get('/forgotPassword',(req,res)=>{
	res.render("forgotPassword",{
		data: "",
		error: ""
	})
});*/

userRouter.post('/forgotPass',(req,res,next)=>{

	async.waterfall([
		function(done) {
		  crypto.randomBytes(20, function(err, buf) {
			var token = buf.toString('hex');
			done(err, token);
		  });
		},
		function(token, done) {
			
		  User.findOne({userEmailId : req.body.email }, function(err, user) {
			if (!user) {
			  req.flash('error', 'No account with that email address exists.');
			  return res.redirect('/users/forgotPass');
			}
	
			user.resetPasswordToken = token;
			user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
	
			user.save(function(err) {
			  done(err, token, user);
			});
		  });
		},
		function(token, user, done) {
		  var smtpTransport = nodemailer.createTransport({
			service: 'gmail',
			auth: {
				user: process.env.mailID,
				pass: process.env.mailPassword			}
		  });
		  var mailOptions = {
			to: user.userEmailId,
			from: process.env.mailID,
			subject: 'DA Scanner Password Reset',
			text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
			  'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
			  'http://' + req.headers.host + '/users/reset/' + token + '\n\n' +
			  'If you did not request this, please ignore this email and your password will remain unchanged.\n'
		  };
		  smtpTransport.sendMail(mailOptions, function(err) {
			req.flash('info', 'An e-mail has been sent to ' + user.userEmailId + ' with further instructions.');
			done(err, 'done');
		  });
		}
	  ], function(err) {
		if (err) return next(err);
		res.redirect('/users/forgotPass');
	  });

})



userRouter.get("/changePassword/:id",loggedin,(req,res)=>{

	res.render('ChangePassword',{
		title: req.user.fName + "  " + req.user.lName,
		error: null,
		msg: "",
		id: req.params.id
	})
});

// CHANGE PASSWORD POST REQUEST
userRouter.post("/changePassword",loggedin,(req,res) =>{

	console.log(req.body.oldPassword);
	let user = req.user;
	let oldPassword = req.body.oldPassword;
	let newPassword = req.body.newPassword;

	//COMPARING ENTERED PASS WITH OLD PASS
	bcrypt.compare(oldPassword,user.password,async (err,valid)=>{
		if(err){
			console.log(err);
		}
		if(valid)
		{
		//console.log("HEYYYYY");
			let user = req.user;

			//HASHING PASSWORD BEFORE UPDATING
			const hashedPass = await bcrypt.hash(req.body.newPassword,10);
			User.findByIdAndUpdate({_id:user._id},{$set: {password:hashedPass}},{new:false},function(err,user){
			if(err)
			{
				console.log(err);
			}
			else{
				res.render("ChangePassword",{
					msg: "Password Changed",
					error: "",
					title: "Welcome",
					id: req.user.userTypeId
				})
			}
		})
		}
	else{
		//console.log("not");
		res.render("ChangePassword",{
			msg: "",
			error: "Old password Incorrect",
			title: ""
		})
	}
	});
	

})



userRouter.get('/registerStudent',(req,res)=>{
	res.render("studentRegistration",{
		data: "",
		error: ""
	})
});




userRouter.post('/registerStudent',(req,res)=>{

	User.findById(req.body.stuID, (err,doc)=>{
		if(doc)
		{
			req.session.userData = doc;
			res.redirect("/");
				
		}
		else{
			let user = new User();

			let ID = req.body.stuID;
			let batch = ID.substr(4,2);
			let year = ID.substr(0,4);
			year = parseInt(year);

			Course.findById(batch,async (err,doc)=>{
				if(doc){
					const hashedPass = await bcrypt.hash(req.body.password,10); //await as async 
					user.userTypeId = 5; //as student
					user.courseName = doc.course_name;
					user.batchYear = year + (parseInt(doc.duration));
					user.fName = req.body.fname;
					user.lName = req.body.lname;
					user.password=hashedPass;
					user.userEmailId = req.body.emailId;
					user.enabled = true;
					user._id = ID;

					// Appending ID with time to generate QR string 
					let id1=user._id;
					id1=id1.toString();
					id1=id1+Date.now();
					user.qr_code = id1;
					user.qr_cnt = 5 ; //Initially 5 counts available


					user.save().then(result=>{

						 qr.generateQR(user._id,id1,(flag)=>{
							if(!flag){
								console.log(err);
							}
							else{
							res.render("loginPage",{
							title: "Successfully Register. Login to continue",
							error: ""
							})

						 }
						});
							
					}).catch(err=>{
						res.render("studentRegistration",{
							data: req.body,
							error: "Server Error"
						})
					})

				}
				else{
					res.render("studentRegistration",{
						data: req.body,
						error: "ID is invalid - Course does not exist"
					})
				}
			})

			
			


		}
	})

})


module.exports = userRouter;

/*
[
	check("userId","this userId is already exist").trim()
	.custom((value,request) =>
	{
		User.findById(value)
		.then(user =>
		{
			if(user)
			{
				throw new Error();
			}
			else
			{
				return true;
			}
		})
		.catch(err =>
		{
			console.log("error occured while findById in User");
			console.log(err);
		})
	})
	,
	check("userEmailId", "Enter valid email address").trim().isEmail(),
	check("userEmailId", "this email is already exist").trim().isEmail().custom((value) =>
	{
		User.find({userEmailId: value})
		.then(user =>
		{
			console.log(user);
			if(user)
			{
				throw new Error();
			}
			else
			{
				return true;
			}
		})
		.catch(err=>
		{
			console.log("error occured while find in User");
			console.log(err);
		})
	})
	,
	check("password", "Enter valid password").trim().isLength({min: 8}),
	check("passwordAgain").custom((value,request)=>
	{
		//console.log(request.req.body.password);
		if(value != request.req.body.password)
		{
			//console.log(value);
			throw new Error("password does not match");
		}
		else
		{
			return true;
		}
	})
]
,
*/