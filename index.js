var express = require('express');
var url = require('url');
var router = express.Router();
var app = express();
var bodyParser = require("body-parser");  
const RippleAPI = require('ripple-lib').RippleAPI;
const keypairs = require('ripple-keypairs')
const elliptic = require('elliptic')
const Secp256k1 = elliptic.ec('secp256k1')
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

//var serveraddress = 'wss://s.altnet.rippletest.net:51233' // Public rippled server hosted by Ripple, Inc.
//var serveraddress = 'ws://127.0.0.1:6006'  //localhost
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

function bytesToHex(a) {
  return a.map(function(byteValue) {
    const hex = byteValue.toString(16).toUpperCase()
    return hex.length > 1 ? hex : '0' + hex
  }).join('')
}

app.use(bodyParser.urlencoded({ extended: false })); 
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
			json.code = 0
			json.data = {}
			json.data.address = account.address
			json.data.secret = account.secret			
			res.end(JSON.stringify(json))
			console.log((new Date()).toLocaleString(),"新账户信息:",account)
		}catch(err){
			logger.error('请求生成账号失败异常:', err.message)
			console.log((new Date()).toLocaleString(),"请求生成账号失败异常",err.message);     //网络请求失败返回的数据  		
			var json = {};
			json.msg = "生成账号失败异常"
			json.errcode = -1
			json.code = -1
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
	var json = {};
	if (address.substr(0,1) != 'r'){		
		json.msg = "地址非法"
		json.errcode = -3
		json.code = -3
		res.end(JSON.stringify(json))	
		logger.error('地址非法:', address)
		console.log((new Date()).toLocaleString(),"地址非法:",json)
		return
	}
	apiPromise.then(()=>{
		try{
			rippleApi.getBalances(address).then(balance =>{
				logger.info('getBalances: ',balance)
				//var r = JSON.parse(balance)
				for (var i=0; i< balance.length; i++){
					if (balance[i].currency == "XRP"){										
						json.amount = (parseFloat(balance[i].value) * 1000000).toString();
						json.errcode = 0
						json.code = 0
						json.data = {}
						json.data.amount = (parseFloat(balance[i].value) * 1000000).toString();
						res.end(JSON.stringify(json))
						console.log((new Date()).toLocaleString(),"余额:",json)
						return;
					}
				}
				json.msg = "没有查询到记录"
				json.errcode = -1
				json.code = -1
				res.end(JSON.stringify(json))
				console.log((new Date()).toLocaleString(),json);     //网络请求失败返回的数据 
			}).catch((err) => {				
				logger.error('获取余额返回失败:', err.message)			
				if (err.message == 'actNotFound' || err.message == 'Account not found.'){
						json.amount = 0
						json.errcode = 0	
						json.code = 0
						json.data = {}						
						json.data.amount = 0
				}else{
					json.errcode = -1
					json.code = -1
					json.msg = "获取余额失败"					
				}
				res.end(JSON.stringify(json))
				console.log((new Date()).toLocaleString(),"获取余额返回失败",json);     //网络请求失败返回的数据  
			});
		}catch(err){
			logger.error('请求获取余额异常:', err.message)
			json.msg = "获取余额异常"
			json.errcode = -1
			json.code = -1
			res.end(JSON.stringify(json))			 
			console.log((new Date()).toLocaleString(),"请求获取余额异常",json);     //网络请求失败返回的数据  
		}
	});		
});

app.get('/wallet/xrp/gettransaction', function (req, res, next) {	 	
	logger.info("查询txUrl",req.url)
	console.log("查询txUrl",req.url)	
	var arg = url.parse(req.url, true).query; 
	var id = arg.txid
	var json = {};
	apiPromise.then(()=>{			
		rippleApi.getTransaction(id).then(transaction => {
			console.log(transaction);
			json.errcode = 0
			json.code = 0
			json.data = transaction
			res.end(JSON.stringify(json))					
			console.log((new Date()).toLocaleString(),"交易查询成功:",json)	 							
		}).catch( (err) => {
			logger.error('txid非法:', err.message)
			console.log((new Date()).toLocaleString(), "txid非法",err.message); 			
			json.msg = "txid非法"
			json.errcode = -1
			json.code = -1
			res.end(JSON.stringify(json))	
			return	
		});			
	});
});

app.get('/wallet/xrp/sendto', function (req, res, next) {	 
	//logger.info("转账Url",req.url);
	//console.log("转账Url",req.url);
	var arg = url.parse(req.url, true).query; 
	var privkey = arg.privkey;
	var fromaddress = arg.fromaddress;
	var toaddress = arg.toaddress;
	var tag = arg.tag;
	var amount = arg.amount; 
	sendto(res,privkey,fromaddress,toaddress,tag,amount)
});

var multipart = require('connect-multiparty');
var multipartMiddleware = multipart();   
app.post('/wallet/xrp/sendto',multipartMiddleware, function (req, res, next) {	
	var privkey = req.body.privkey;
	var fromaddress = req.body.fromaddress;
	var toaddress = req.body.toaddress;	
	var tag = req.body.tag;
	var amount = req.body.amount;
	sendto(res,privkey,fromaddress,toaddress,tag,amount)
})

app.post('/wallet/xrp/setaccount',multipartMiddleware, function (req, res, next) {	
	var account = req.body.account;
	var privkey = req.body.privkey;		
	var required = req.body.required === "yes" ? true : false;
	//console.log("账号",account,"私钥",privkey,"required", required);
	var json = {};	
	apiPromise.then(()=>{	
		const address = account;	
		const settings = {
				"requireDestinationTag": required
		};
		
		rippleApi.prepareSettings(address, settings).then(prepared => {			
			try{
				var ptxJSON = JSON.parse(prepared.txJSON);	   
				var txJSON = JSON.stringify(ptxJSON);
				console.log((new Date()).toLocaleString(), "交易详情:", txJSON);						
				//如果私钥是s开头
				if (privkey.substr(0,1) == 's'){
					const secret = privkey;	
					//id signedTransaction		
					var tx = rippleApi.sign(txJSON, secret);
				}else{
					//根据私钥生成公钥
					try{
						var publickey;
						if (privkey.length == 66){
							publickey = bytesToHex(Secp256k1.keyFromPrivate(privkey.slice(2)).getPublic().encodeCompressed());
						}else{
							publickey = bytesToHex(Secp256k1.keyFromPrivate(privkey).getPublic().encodeCompressed());
							privkey = '00' + privkey;
						}
					}catch(err){
						logger.error('私钥格式不对:', err.message)
						console.log((new Date()).toLocaleString(), "私钥格式不对:",err.message); 
						json.msg = "私钥格式不对";
						json.errcode = -3;
						json.code = -3;
						res.end(JSON.stringify(json));
						return		
					}				
					const keypair = { privateKey: privkey, publicKey: publickey };
					//id signedTransaction		
					var tx = rippleApi.sign(txJSON, keypair); 
				}
				logger.info("tx:",tx)
			}catch(err){
				logger.error('签名tx失败:', err)
				console.log((new Date()).toLocaleString(), "签名tx失败",err.message); 
				json.msg = "交易失败";
				json.errcode = -2;
				json.code = -2;
				res.end(JSON.stringify(json))	
				return	
			}
			try{
				rippleApi.submit(tx.signedTransaction).then(result => {	
					logger.info("submit signedTransaction: ",result)				
					if (result.resultCode == "tesSUCCESS"){
						json.errcode = 0
						json.code = 0
						json.txid = tx.id
						json.data = {};
						json.data.txid = tx.id;
						res.end(JSON.stringify(json))					
						console.log((new Date()).toLocaleString(),"交易成功:",json)	 	
					}else{
						json.errcode = -5
						json.code = -5
						json.msg = "交易失败"
						res.end(JSON.stringify(json))				
						console.log("submit signedTransaction: ",result)					
						console.log((new Date()).toLocaleString(),"交易失败:",json)	 					
					}
				}).catch( (err) => {
					logger.error('发送tx请求失败:', err.message)
					console.log((new Date()).toLocaleString(), "发送tx请求失败",err.message);     //网络请求失败返回的数据  		
					json.errcode = -4
					json.code = -4
					json.msg = "交易失败"
					res.end(JSON.stringify(json))
					return
				});			
			}catch(err){
				logger.error('发生未知异常:', err.message)
				console.log((new Date()).toLocaleString(), "发生未知异常",err.message); 
				json.msg = "交易失败"
				json.errcode = -1
				json.code = -1
				res.end(JSON.stringify(json))	
				return		
			}				
		}).catch( (err) => {
				logger.error('构造Settings失败:', err.message)
				console.log((new Date()).toLocaleString(), "构造Settings失败",err.message);     //网络请求失败返回的数据  		
				json.errcode = -4
				json.code = -4
				json.msg = "交易失败"
				res.end(JSON.stringify(json))
				return
			});									
	}).catch((err) => {
			logger.error('apiPromise失败:', err.message)
			console.log((new Date()).toLocaleString(),"apiPromise失败",err.message);     //网络请求失败返回的数据  
			json.errcode = -1
			json.code = -1
			json.msg = "交易失败"
			res.end(JSON.stringify(json))
			return
	});			
})

function sendto(res,privkey,fromaddress,toaddress,tag,amount){
	var json = {};
	try
	{
		var _amount = parseInt(amount) 	
		if (_amount <= 0){
			throw new Error(`amount:${_amount} <= 0 `)
		}
	}catch(err){
		logger.error('金额非法:', err.message)
		console.log((new Date()).toLocaleString(), "金额非法",err.message); 			
		json.msg = "金额非法"
		json.errcode = -3
		json.code = -3
		res.end(JSON.stringify(json))	
		return		
	}		
	logger.info("转账从",fromaddress,"到",toaddress,_amount)
	console.log((new Date()).toLocaleString(),"转账从",fromaddress,"到",toaddress,_amount)	
		
	apiPromise.then(()=>{					
		const payment = {
		  "source": {
			"address": fromaddress,
			"maxAmount": {
				"value": _amount.toString(),
				"currency": "drops"	
			}			
		  },
		  "destination": {
			"address": toaddress,
			"amount":{
				"value": _amount.toString(),
				"currency": "drops"	
			} 
		  }
		};	
		//获取Fee和Sequence
		rippleApi.preparePayment(fromaddress, payment).then(prepared =>{					
			try{		
				var ptxJSON = JSON.parse(prepared.txJSON);
				//这里根据客户输入增加DestinationTag标记
				if(tag != ""){
					ptxJSON.DestinationTag = tag;
				}			   
				var txJSON = JSON.stringify(ptxJSON);
				console.log((new Date()).toLocaleString(), "交易详情:", txJSON);				
				//如果私钥是s开头
				if (privkey.substr(0,1) == 's'){
					const secret = privkey;	
					//id signedTransaction		
					var tx = rippleApi.sign(txJSON, secret);
				}else{
					//根据私钥生成公钥
					try{
						var publickey;
						if (privkey.length == 66){
							publickey = bytesToHex(Secp256k1.keyFromPrivate(privkey.slice(2)).getPublic().encodeCompressed());
						}else{
							publickey = bytesToHex(Secp256k1.keyFromPrivate(privkey).getPublic().encodeCompressed());
							privkey = '00' + privkey;
						}
					}catch(err){
						logger.error('私钥格式不对:', err.message)
						console.log((new Date()).toLocaleString(), "私钥格式不对:",err.message); 
						json.msg = "私钥格式不对";
						json.errcode = -3;
						json.code = -3;
						res.end(JSON.stringify(json));
						return		
					}				
					const keypair = { privateKey: privkey, publicKey: publickey };
					//id signedTransaction		
					var tx = rippleApi.sign(txJSON, keypair); 
				}
				logger.info("tx:",tx)
			}catch(err){
				logger.error('签名tx失败:', err.message)
				console.log((new Date()).toLocaleString(), "签名tx失败",err.message); 
				json.msg = "交易失败"
				json.errcode = -2
				json.code = -2
				res.end(JSON.stringify(json))	
				return	
			}
				
			try{
				rippleApi.submit(tx.signedTransaction).then(result => {	
					logger.info("submit signedTransaction: ",result)				
					if ((result.resultCode == "tesSUCCESS") || (result.resultCode == "terQUEUED")){
						json.errcode = 0
						json.code = 0
						json.txid = tx.id
						json.msg + result.resultCode
						json.data = {}
						json.data.txid = tx.id
						res.end(JSON.stringify(json))					
						console.log((new Date()).toLocaleString(),"交易成功:",json)	 	
					}else{
						json.errcode = -5
						json.code = -5
						json.msg = "交易失败"
						res.end(JSON.stringify(json))				
						console.log("submit signedTransaction: ",result)					
						console.log((new Date()).toLocaleString(),"交易失败:",json)	 					
					}
				}).catch( (err) => {
					logger.error('发送tx请求失败:', err.message)
					console.log((new Date()).toLocaleString(), "发送tx请求失败",err.message);     //网络请求失败返回的数据  		
					json.errcode = -4
					json.code = -4
					json.msg = "交易失败"
					res.end(JSON.stringify(json))
					return
				});			
			}catch(err){
				logger.error('发生未知异常:', err.message)
				console.log((new Date()).toLocaleString(), "发生未知异常",err.message); 
				json.msg = "交易失败"
				json.errcode = -1
				json.code = -1
				res.end(JSON.stringify(json))	
				return		
			}				
		}).catch((err) => {
			logger.error('preparePayment失败:', err.message)
			console.log((new Date()).toLocaleString(),"preparePayment失败",err.message);     //网络请求失败返回的数据  
			json.errcode = -1
			json.code = -1
			json.msg = "交易失败"
			res.end(JSON.stringify(json))
			return
		});
	}).catch((err) => {
			logger.error('apiPromise失败:', err.message)
			console.log((new Date()).toLocaleString(),"apiPromise失败",err.message);     //网络请求失败返回的数据  
			json.errcode = -1
			json.code = -1
			json.msg = "交易失败"
			res.end(JSON.stringify(json))
			return
	});	
}

module.exports = router;
var port = 84;
var args = process.argv.splice(2)
if(args.length == 1){
	port = parseInt(args[0]);
}

var server = app.listen(port, function () {   //监听端口
  var host = server.address().address
  var port = server.address().port
  console.log('Example app listening at http://%s:%s', host, port);
})