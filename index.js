const heatmap = require('./heatmap');
const wptutils = require('./wpt-utils');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');

const bodyParser = require('body-parser');
const compression = require('compression');
const url = require('url');

const {NODE_ENV} = process.env;
if (NODE_ENV == "development") {
    require('dotenv').config();
}

const defaultServer = process.env.WPT_SERVER;

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(compression());

app.use(express.static('public'));

let port = process.env.PORT;

const errMsg = {"statusCode":400,"statusText":"Generic ERROR"};

app.listen(port, () => {
    app.get('/locations', (req,res) => {
        let server = (req.query.server?req.query.server:defaultServer);
        wptutils.getLocations(server).then((locations) => {
            res.json(locations);
        });
    });
    app.get('/status', (req, res) => {
        server = (req.query.server?req.query.server:defaultServer);
        if (!req.query.test) {
            res.json(errMsg);
        } else {
            let testId = req.query.test;
            wptutils.getStatus(testId,server).then((response)=>{
                res.json(response);
            });
        }
    });
    app.get('/result', (req,res) => {
        if (!req.query.test) {
            res.json(errMsg);
        } else {
            console.log(req.query);
            console.log(req.query.requests);
            server = (req.query.server?req.query.server:defaultServer);
            requests = (req.query.requests?parseInt(req.query.requests):1);
            wptutils.getResultSummary(req.query.test,server,requests).then((result) => {
                res.json(result);
            });
        }
    });
    app.post('/submit', (req, res) => {
        if (!(req.body.url && req.body.location && req.body.server)) {
            res.json(errMsg);
        } else {
            let url = req.body.url;
            let server = req.body.host;
            let location = req.body.server+":"+req.body.location;
            wptutils.submitTest(url,server,location).then((response)=>{
                res.json(response);
            });
        }
    });
    app.get('/analyze', (req,res) => {
        if (!req.query.test) {
            res.json({"statusCode":400,"statusText":"Test ID not supplied"});
        }
        server = (req.query.server?req.query.server:defaultServer);
        wptutils.analyze(req.query.test,path.join('public','tests')).then(()=>{
            res.json({"statusCode":200,"statusText":`Analysis for ${req.query.test} completed`});
        });
    });
    app.post('/submitDomains', (req, res) => {
        if (!(req.body["selected-domains"] && req.body["original-url"] && req.body.location)) {
            res.json(errMsg);    
        }
        server = (req.body.server?req.body.server:defaultServer);
        console.log("submitting tests for",req.body);
        wptutils.submitBlockTests(req.body).then((response) => {
            console.log("tests submitted");
            let testDir = path.join('public','tests');
            let dir = path.join(testDir,req.body["original-testid"]);
            if (fs.existsSync(dir)){
                fs.removeSync(dir);
            }
            fs.mkdirSync(dir);
            
            jsonData = {
                "testId": req.body["original-testid"],
                "testUrl": req.body["origina-url"],
                "tests": [{"blocked":"","testId":req.body["original-testid"]}].concat(response)
            };
            fs.writeFile(
                path.join(dir,"data.json"),
                JSON.stringify(jsonData),
                (err)=>{
                    if (err) {
                        throw new Error(err);
                    }
                    res.redirect("/render/?test="+req.body["original-testid"]);
                }
            );
        });
    });
});