var express = require('express');
var url = require('url');
var router = express.Router();
var app = express();
const RippleAPI = require('ripple-lib').RippleAPI;
const log4js = require('log4js');
log4js.configure({
  appenders: { 
	normal: { 
		type: 'file', 
		filename: "/root/ripplewallet/logs/file.log",
		maxLogSize: 1024*1024*1,
		backups: 100		
	} },
  categories: { 
	default: { 
		appenders: ['normal'], 
		level: 'info' 
	} }
});
const logger = log4js.getLogger('normal');

//var serveraddress: 'wss://s.altnet.rippletest.net:51233' // Public rippled server hosted by Ripple, Inc.
//var serveraddress: 'ws://127.0.0.1:6006'  //localhost
var serveraddress = 'wss://s2.ripple.com:443' // Public rippled server hosted by Ripple, Inc.
  
const rippleApi = new RippleAPI({
  server: serveraddress
});

rippleApi.on('error', (errorCode, errorMessage) => {
  console.log(errorCode + ': ' + errorMessage);
});

rippleApi.on('connected', () => {
  console.log('connected');
});

rippleApi.on('disconnected', (code) => {
	console.log('disconnected, code:', code);
	apiPromise.then(()=>{return;})
});

var apiPromise = rippleApi.connect().then(() => {
    console.log("api connect begin!");
});


app.get('/wallet/xrp/generate', function (req, res, next){
	logger.info("生成账号Url",req.url)
	console.log("生成账号Url",req.url)	
	apiPromise.then(()=>{
		try{
			var account = rippleApi.generateAddress();
			logger.info(account)			
			var json = {};
			json.address = account.address
			json.secret = account.secret
			json.errcode = 0
			res.end(JSON.stringify(json))
			console.log((new Date()).toLocaleString(),"新账户信息:",account)
		}catch(err){
			logger.error('请求生成账号失败异常:', err.message)
			console.log((new Date()).toLocaleString(),"请求生成账号失败异常",err.message);     //网络请求失败返回的数据  		
			var json = {};
			json.msg = "生成账号失败异常"
			json.errcode = -1
			res.end(JSON.stringify(json))			 
		}	
	});
})

app.get('/wallet/xrp/balance', function (req, res, next){
	logger.info("查询余额Url",req.url)
	console.log("查询余额Url",req.url)		
	var arg = url.parse(req.url, true).query; 
	var address = arg.address
	logger.info("查询余额,地址:",address)
	console.log((new Date()).toLocaleString(),"查询余额,地址:",address)
	apiPromise.then(()=>{
		try{
			rippleApi.getBalances(address).then(balance =>{
				logger.info(balance)
				//var r = JSON.parse(balance)
				for (var i=0; i< balance.length; i++){
					if (balance[i].currency == "XRP"){				
						var json = {};
						json.amount = balance[i].value
						json.errcode = 0
						res.end(JSON.stringify(json))
						console.log((new Date()).toLocaleString(),"余额:",json)
						return;
					}
				}
				var json = {};
				json.msg = "没有查询到记录"
				json.errcode = -1
				res.end(JSON.stringify(json))
			}).catch((err) => {
				logger.error('获取余额失败:', err.message)
				console.log((new Date()).toLocaleString(),"获取余额失败",err.message);     //网络请求失败返回的数据  
				var json = {};
				json.errcode = -1
				json.msg = "获取余额失败"
				res.end(JSON.stringify(json))
			});
		}catch(err){
			logger.error('请求获取余额异常:', err.message)
			console.log((new Date()).toLocaleString(),"请求获取余额异常",err.message);     //网络请求失败返回的数据  		
			var json = {};
			json.msg = "获取余额异常"
			json.errcode = -1
			res.end(JSON.stringify(json))			 
		}
	});		
})


app.get('/wallet/xrp/sendto', function (req, res, next) {	 
	logger.info("转账Url",req.url)
	console.log("转账Url",req.url)	
	apiPromise.then(()=>{	
		try
		{
			var arg = url.parse(req.url, true).query; 
			var privkey = arg.privkey
			var fromaddress = arg.fromaddress
			var toaddress = arg.toaddress			
			var amount = parseInt(arg.amount) 	
			if (amount <= 0){
				throw new Error(`amount:${amount} <= 0 `)
			}
		}catch(err){
			logger.error('金额非法:', err.message)
			console.log((new Date()).toLocaleString(), "金额非法",err.message); 
			var json = {};
			json.msg = "金额非法"
			json.errcode = -3
			res.end(JSON.stringify(json))	
			return		
		}
		
		logger.info("转账从",fromaddress,"到",toaddress,amount)
		console.log((new Date()).toLocaleString(),"转账从",fromaddress,"到",toaddress,amount)		
				
		const payment = {
		  "source": {
			"address": fromaddress,
			"maxAmount": {
				"value": amount.toString(),
				"currency": "drops"	
			}			
		  },
		  "destination": {
			"address": toaddress,
			"amount":{
				"value": amount.toString(),
				"currency": "drops"	
			} 
		  }
		};	
		console.log(payment)
		//获取Fee和Sequence
		rippleApi.preparePayment(fromaddress, payment).then(prepared =>{
			console.log("prepared: ",prepared);	
			logger.info(prepared)				
			try{		
				const txJSON = prepared.txJSON;
				const secret = privkey;		
				console.log("txJSON: ",txJSON)
				//id signedTransaction		
				var tx = rippleApi.sign(txJSON, secret); 
				logger.info(tx)
				console.log(tx)
			}catch(err){
				logger.error('签名tx失败:', err.message)
				console.log((new Date()).toLocaleString(), "签名tx失败",err.message); 
				var json = {};
				json.msg = "交易失败"
				json.errcode = -2
				res.end(JSON.stringify(json))	
				return	
			}
				
			try{
				console.log("signedTransaction: ",tx.signedTransaction)
				rippleApi.submit(tx.signedTransaction).then(result => {	
					logger.info("submit signedTransaction: ",result)				
					if (result.resultCode == "tesSUCCESS"){
						var json = {};
						json.errcode = 0
						json.txid = tx.id
						res.end(JSON.stringify(json))					
						console.log((new Date()).toLocaleString(),"交易成功:",json)	 
					}else{
						var json = {};
						json.errcode = -5
						json.msg = "交易失败"
						res.end(JSON.stringify(json))				
						console.log("submit signedTransaction: ",result)					
						console.log((new Date()).toLocaleString(),"交易失败:",json)	 					
					}
				}).catch( (err) => {
					logger.error('发送tx请求失败:', err.message)
					console.log((new Date()).toLocaleString(), "发送tx请求失败",err.message);     //网络请求失败返回的数据  
					var json = {};				
					json.errcode = -4
					json.msg = "交易失败"
					res.end(JSON.stringify(json))
					return
				});			
			}catch(err){
				logger.error('发生未知异常:', err.message)
				console.log((new Date()).toLocaleString(), "发生未知异常",err.message); 
				var json = {};
				json.msg = "交易失败"
				json.errcode = -1
				res.end(JSON.stringify(json))	
				return		
			}				
		}).catch((err) => {
			logger.error('preparePayment失败:', err.message)
			console.log((new Date()).toLocaleString(),"preparePayment失败",err.message);     //网络请求失败返回的数据  
			var json = {};
			json.errcode = -1
			json.msg = "交易失败"
			res.end(JSON.stringify(json))
			return
		});
	})
})

module.exports = router;

var server = app.listen(8888, function () {   //监听端口
  var host = server.address().address
  var port = server.address().port
  console.log('Example app listening at http://%s:%s', host, port);
})