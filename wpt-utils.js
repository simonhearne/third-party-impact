const path = require('path');
const fs = require('fs-extra');
const webpagetest = require('webpagetest');
const heatmap = require('./heatmap');
const admzip = require('adm-zip');

const {NODE_ENV} = process.env;
if (NODE_ENV == "development") {
    require('dotenv').config();
}
const defaultServer = process.env.WPT_SERVER;
const wptAPIkey = process.env.WPT_APIKEY;

getStatus = function(testId) {
    return new Promise((resolve)=>{
        const wpt = new webpagetest();
        wpt.getTestStatus(testId, {request: 12345}, (err,data) => {
            if (err) throw new Error(err);
            return resolve(data);
        });
    });
};

submitTest = function(url,server=null,location=null,opts=null) {
    return new Promise((resolve) => {
        server = (server==null?defaultServer:server);
        let iq = 100;
        const wpt = new webpagetest(server);
        if (opts) {
            let iq = (opts.iq==undefined?100:opts.iq);
        }
        wpt.runTest(url, {
            location:location,
            disableOptimization:true,
            video:true,
            key:wptAPIkey,
            firstViewOnly:true,
            runs:3,
            medianVideo:true,
            timeline:true
        }, (err, data) => {
            if (err) throw new Error(err);
            return resolve(data);
        });
    });
};

submitBlockTest = function(url,block,server=null,location=null,opts=null) {
    return new Promise((resolve) => {
        server = (server==null?defaultServer:server);
        let iq = 100;
        const wpt = new webpagetest(server);
        if (opts) {
            let iq = (opts.iq==undefined?100:opts.iq);
        }
        wpt.runTest(url, {
            location:location,
            disableOptimization:true,
            video:true,
            key:wptAPIkey,
            firstViewOnly:true,
            runs:3,
            block:block,
            label:"blocked: "+block,
            medianVideo:true,
            timeline:true
        }, (err, data) => {
            if (err) throw new Error(err);
            return resolve({"blocked":block,"testId":data.data.testId});
        });
    });
};

combinate = function(arr,sep=" ") {
    var combi = [];
    var temp = "";
    var combiLen = Math.pow(2, arr.length);

    for (var i = 0; i < combiLen ; i++){
        temp = "";
        for (var j=0;j<arr.length;j++) {
            if ((i & Math.pow(2,j))){ 
                temp += arr[j] + sep;
            }
        }
        if (temp !== "") {
            combi.push(temp);
        }
    }
    return combi;
};

submitBlockTests = function(data) {
    server = (data.server==null?defaultServer:data.server);
    if (typeof(data["selected-domains"]) !== "object") {
        data["selected-domains"] = [data["selected-domains"]];
    }
    
    console.log(data["selected-domains"]);
    var combi = combinate(data["selected-domains"]);
    console.log(combi);
    var tests = [];
    combi.forEach((domain) => {
        tests.push(submitBlockTest(data["original-url"],domain,server,data.location,null));
    });
    return Promise.all(tests);
};

getResultSummary = function(testId,server=null,requests=1) {
    return new Promise((resolve) => {
        let opts = {};
        opts.requests = requests;
        server = (server==null?defaultServer:server);
        const wpt = new webpagetest(server);
        wpt.getTestResults(testId, opts=opts, (err,data) => {
            if (err) throw new Error(err);
            return resolve(data);
        });
    });
};

getLocations = function(server) {
    return new Promise((resolve) => {
        const wpt = new webpagetest(server);
        wpt.getLocations((err,data) => {
            if (err) throw new Error(err);
            return resolve(data);
        });
    });
};

analyzeTestData = function(testId,testDir,server=null) {
    return new Promise((resolve,reject) => {
        return resolve(true);
    });
};

return module.exports = {
    getStatus: getStatus,
    submitTest: submitTest,
    getLocations: getLocations,
    getResultSummary,
    analyzeTestData,
    submitBlockTests
};