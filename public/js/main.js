function getLocations() {
    server = document.getElementById("wpt-host").value;
    let url = `/locations?server=${server}`;
    fetch(url)
        .then((res) => {
            if (!res.ok) {
                throw Error(res.statusText);
            }
            return res.json();
        })
        .then((data) => {
            parseLocations(data,'wpt-location');
        })
        .catch((error)=>{
            statusUpdate({"status":"error","message":`Failed to get locations from <em>${server}</em><br/>${error}`});
        });
}

function statusUpdate(opts) {
    let elem = document.getElementById("status");
    let stat = "info";
    if ("status" in opts) stat = opts.status;
    let message = "";
    if ("message" in opts) message = opts.message;
    elem.className = stat;
    elem.innerHTML = message;
}

function parseLocations(locationData,selectElem) {
    let locations = locationData.response.data.location;
    groups = {};
    locations.forEach((location)=>{
        let group = location.group;
        if (group !== undefined) {
            if (!(group in groups)) {
                groups[group] = {"name":group,"locations":[]};
            }
            groups[group].locations.push(location);
        }
    });
    window.wpt.locations = locations;
    window.wpt.groups = groups;
    let select = document.getElementById(selectElem);
    for (var group in groups) {
        let optgroup = document.createElement('optgroup');
        optgroup.label = group;
        for (var i in groups[group].locations) {
            let location = groups[group].locations[i];
            if (location.status == "OK") {
                let opt = document.createElement('option');
                opt.id = location.id;
                if (opt.id == "Dulles") {
                    opt.selected = "selected";
                }
                opt.text = location.Label;
                let pendTests = location.PendingTests.Total;
                if (pendTests > 5) {
                    opt.text += ` - ${pendTests} queued tests`;
                }
                optgroup.appendChild(opt);
            }
        }
        select.add(optgroup);
    }
    updateBrowsers();
}

function updateBrowsers() {
    let elem = document.getElementById("wpt-location");
    let targetElem = document.getElementById("wpt-browser");
    let selection = elem.options[elem.options.selectedIndex];
    let server = selection.id;
    let browsers = window.wpt.locations.filter((obj)=>{return obj.id==server;})[0].Browsers.split(",");
    clearOptions(targetElem);
    for (var i in browsers) {
        let opt = document.createElement('option');
        opt.id = browsers[i];
        opt.text = browsers[i];
        targetElem.add(opt);
    }
}

function clearOptions(elem) {
    if (typeof(elem)=="string") {
        elem = document.getElementById(elem);
    }
    for ( var i = elem.options.length - 1 ; i >= 0 ; i--)
    {
        elem.remove(i);
    }

}

function checkStatus(testId) {
    server = document.getElementById("wpt-host").value;
    let url = `/status?server=${server}&test=${testId}`;
    fetch(url)
    .then((res) => {
        if (!res.ok) {
            throw Error(res.statusText);
        }
        return res.json();
    })
    .then((data) => {
        parseStatus(data,testId);
    })
    .catch((error)=>{
        statusUpdate({"status":"error","message":`Failed to get test status for <em>${testId}</em> from <em>${server}</em><br/>${error}`});
    });

}

function analyzeTestData(testId) {
    statusUpdate({"status":"success","message":`Analysis complete. Redirecting to /domains/?test=${testId}`});
    window.location=`/domains/?test=${testId}`;
}

function parseStatus(data,testId) {
    if (data.statusCode == 100 || data.statusCode == 101) {
        /* test is queued / testing */
        statusUpdate({"status":"info","message":data.statusText+"<br/>Test ID: <em>"+testId+"</em>"});
        window.setTimeout(()=>{checkStatus(testId);},2500);
    } else if (data.statusCode == 200) {
        statusUpdate({"status":"success","message":"Test Complete. Analyzing..."});
        analyzeTestData(testId);
        /* test is complete */
    } else {
        /* error? */
        statusUpdate({"status":"error","message":`Test Failed (${data.statusCode}).<br/>${data.statusText}`});
    }
}

function useExistingTest() {
    let testId = document.getElementById('wpt-test-id').value;
    checkStatus(testId);
}

function submitTest() {
    let url = document.getElementById("url").value;
    let host = document.getElementById("wpt-host").value;
    let location = document.getElementById("wpt-location");
    let server = location.options[location.options.selectedIndex].id;
    let browser = document.getElementById("wpt-browser").value;
    if (url.length>5 && host && server && browser) {
        let path = "/submit";
        let payload = {
            host: host,
            url: url,
            server: server,
            location: browser
        };
        return fetch(path, {
            body: JSON.stringify(payload),
            cache:'no-cache',
            credentials: 'same-origin',
            headers: {
                "content-type": 'application/json'
            },
            method: 'POST'
        }) 
            .then(response => response.json())
            .then((data) => {
                if (data.statusCode !== 200) {
                    statusUpdate({"status":"error","message":`Test has not been submitted, error message: ${data.statusText}`});    
                    return false;
                } else {
                    let testId = data.data.testId;
                    window.wpt.testId=testId;
                    statusUpdate({"status":"success","message":`Test has been submitted<br/>Test ID: <em>${testId}</em>`});
                    setTimeout(()=>{checkStatus(testId);},1000);
                    return true;
                }
            });
        }
    statusUpdate({"status":"error","message":"Please ensure all fields are completed"});
    return false;
}

const getParameterByName = function(name, url) {
    if (!url) url = window.location.href;
    let cURL = new URL(url);
    return cURL.searchParams.get(name);
};

const getTestInfo = function(test=null,requests=1) {
    return new Promise((resolve,reject) => {
        testId = (test==null?window.heatmap.testId:test);
        let url = `/result?test=${testId}&requests=${requests}`;
        fetch(url)
            .then((res) => {
                if (!res.ok) {
                    throw Error(res.statusText);
                }
                return res.json();
            })
            .then((data) => {
                return resolve(data);
            });
            // .catch((error)=>{
            //     throw Error({"status":"error","message":`Failed to get locations from <em>${server}</em><br/>${error}`});
            // });
        });
};

const parseResults = function(data) {
    return new Promise((resolve,reject) => {
        window.wpt.data = data.data;
        document.getElementById("test-url").innerHTML = data.data.testUrl;
        document.getElementById("test-from").innerHTML = data.data.from.replace(/<b>/gi,"").replace(/<\/b>/gi,"");
        let d = new Date(data.data.completed * 1000);
        document.getElementById("test-run-at").innerHTML = d.toLocaleString();
        document.getElementById('original-testid').value = window.wpt.data.id;
        document.getElementById('original-url').value = window.wpt.data.testUrl;
        document.getElementById('original-location').value = window.wpt.data.location;
        document.getElementById('original-connectivity').value = window.wpt.data.connectivity;
        return resolve(true);
    });
};

const getDomains = function() {
    return new Promise((resolve,reject) => {
        window.wpt.domains = [];
        var domains = window.wpt.data.median.firstView.domains;
        for (var dom in domains) {
            if (domains.hasOwnProperty(dom)) {
                window.wpt.domains.push({"domain":dom,"data":domains[dom],"timing":{"total":0,"beforeFMP":0,"beforeInteractive":0}});
            }
        }
        
        var url = window.wpt.data.median.firstView.rawData.scriptTiming;
        fetch(url)
        .then((res) => {
            if(!res.ok) {
                throw Error(res.statusText);
            }
            return res.json();
        })
        .then((data) => {
            window.wpt.scriptTiming=data[data.main_thread];
            window.wpt.domains.forEach((domain) => {
                //window.wpt.scriptTiming["https://images-na.ssl-images-amazon.com/images/G/01/ape/sf/desktop/sf-1.20._V503294715_.html"].FunctionCall.forEach((f)=>{console.log(f[1]-f[0])})
                for (var resource in window.wpt.scriptTiming) {
                    var url = new URL(resource);
                    if (url.hostname == domain.domain) {
                        domain.timing.total += getScriptTiming(resource);
                        domain.timing.beforeFMP += getScriptTiming(resource,window.wpt.data.median.firstView["PerformancePaintTiming.first-contentful-paint"]);
                        domain.timing.beforeInteractive += getScriptTiming(resource,window.wpt.data.median.firstView.FirstInteractive);
                    }
                }
            });
            window.wpt.domains.sort((a,b)=>{return b.timing.total - a.timing.total;});
            return resolve(true);
        });
    });
};

const getScriptTiming = function(resource,end=Infinity) {
    value = 0;
    var timing = window.wpt.scriptTiming[resource];
    if (timing.hasOwnProperty("FunctionCall")) {
        timing = timing.FunctionCall;
    } else {
        return value;
    }
    if (timing !== undefined) {
        timing.forEach((f) => {
            if (f[1]<end) {
                value += (f[1]-f[0]);
            }
        });
    }
    return value;
};

const showDomains = function() {
    return new Promise((resolve,reject) => {
        var tbl = document.getElementById("domains");
        var datafields = ["bytes","requests","connections"];
        var timingfields = ["total","beforeInteractive"];
        var parentURL = new URL(window.wpt.data.testUrl);
        window.wpt.domains.forEach((domain) => {
            var i = 0;
            var row = tbl.insertRow(tbl.rows.length);
            var cell = row.insertCell(i++);
            var txt = document.createElement("span");
            txt.innerHTML = domain.domain;
            txt.classList.add("domain");
            if (domain.data.hasOwnProperty("cdn_provider")) {
                txt.title = "CDN: "+domain.data.cdn_provider;
            }
            cell.appendChild(txt);
            for (var f in datafields) {
                cell = row.insertCell(i++);
                if (domain.data.hasOwnProperty(datafields[f])) {
                    txt = document.createTextNode(domain.data[datafields[f]].toLocaleString());
                    var max = Infinity;
                    if (datafields[f]=="bytes") {
                        max = 100000;
                    } else if (datafields[f]=="requests") {
                        max = 100;
                    } else if (datafields[f]=="connections") {
                        max = 10;
                    }
                    var cls = "bg-gradient-"+getBGFromValue(domain.data[datafields[f]],max);
                    cell.classList.add(cls);
                } else {
                    txt = document.createTextNode("unknown");
                }
                cell.appendChild(txt);
            }
            for (var f in timingfields) {
                cell = row.insertCell(i++);
                if (domain.timing.hasOwnProperty(timingfields[f])) {
                    txt = document.createTextNode(Math.round(domain.timing[timingfields[f]]));
                    var cls = "bg-gradient-"+getBGFromValue(domain.timing[timingfields[f]],500);
                    cell.classList.add(cls);
                } else {
                    txt = document.createTextNode("unknown");
                }
                cell.appendChild(txt);
            }
            cell = row.insertCell(i++);
            if (parentURL.hostname !== domain.domain) {
                row.onclick=(()=>{
                    var check = document.getElementById("checkbox-"+domain.domain);
                    (check.checked?check.checked=false:check.checked=true);
                });
                var check = document.createElement("input");
                check.type = "checkbox";
                check.id = "checkbox-"+domain.domain;
                check.name = "selected-domains";
                check.value = domain.domain;
                cell.appendChild(check);
            }
        });
        return resolve(true);
    });
};

const hideWaiting = function() {
    document.getElementById("waiting").style.cssText = "opacity:0;";
    setTimeout(()=>{document.getElementById("waiting").classList.add("hidden");},500);
}

const getBGFromValue = function(value,max) {
    /* return a value from 1-10 based on percentage of max */
    if (value > max) return 10;
    if (value <= 1) return 0;
    return Math.floor((value/max)*10);
}

const setUrl = function() {
    let cURL = new URL(window.location.href);
    //cURL.searchParams.set('b',window.heatmap.budget);
    window.history.replaceState(null,null,cURL.toString());
};

const getUrl = function() {
    let cURL = new URL(window.location.href);
    //window.heatmap.budget = (cURL.searchParams.get('b')==null?5000:cURL.searchParams.get('b'));
    setUrl();
};

const getBlocks = function(testId) {
    return new Promise((resolve,reject) => {
        url = `/tests/${testId}/data.json`;
        fetch(url)
        .then((res) => {
            if (!res.ok) {
                throw Error(res.statusText);
            }
            return res.json();
        })
        .then((data) => {
            window.wpt.tests = data.tests;
            return resolve(true);
        });
    });
};

const updateStatus = function() {
    var stats = [];
    window.wpt.tests.forEach((test) => {
        stats.push(
            getTestStatus(test.testId).then((stat) => {
                test.status = stat;
            })
        );
    });
    return Promise.all(stats);
};

const renderStatus = function() {
    document.getElementById("status").classList.remove("hidden");
    var tbl = document.getElementById("status");
    var i=1;
    var rows = tbl.rows.length;
    for (var r=1;r<rows;r++) {
        tbl.deleteRow(1);
    }
    window.wpt.tests.forEach((test) => {
        var row = tbl.insertRow(i);
        var cell = row.insertCell(0);
        var txt = document.createElement("span");
        txt.innerHTML = test.blocked;
        txt.classList.add("domain");
        cell.appendChild(txt);

        cell = row.insertCell(1);
        txt = document.createTextNode(test.status.statusText);
        cell.appendChild(txt);
        i++;
    });
};

const getTestStatus = function(testId) {
    return new Promise((resolve,reject) => {
        let url = `/status?test=${testId}`;
        fetch(url)
        .then((res) => {
            if (!res.ok) {
                throw Error(res.statusText);
            }
            return res.json();
        })
        .then((data) => {
            return resolve(data);
        });
    });
};

const isComplete = function() {
    var complete = true;
    window.wpt.tests.forEach((test) => {
        if (test.status.statusCode !== 200) {
            complete = false;
        }
    });
    return complete;
};

const getResults = function() {
    var results = [];
    window.wpt.tests.forEach((test) => {
        results.push(
            getTestInfo(test.testId,0).then((result) => {
                test.result = result.data.median.firstView;
            })
        );
    });
    return Promise.all(results);
};

const sortResults = function(prop,dir) {
    var first = window.wpt.tests.shift();
    window.wpt.tests.sort((a,b) => {
        if (dir < 0 || dir == "desc") {
            return eval("b.result."+prop) - eval("a.result."+prop);
        } else {
            return eval("a.result."+prop) - eval("b.result."+prop);
        }
    });
    window.wpt.tests.unshift(first);
};

const renderResults = function() {
    document.getElementById("status").classList.add("hidden");
    document.getElementById("results").classList.remove("hidden");
    getResults()
    .then(() => {
        console.log(wpt.tests);
        sortResults("SpeedIndex","asc");
        renderResultsTable();
    });
};

const renderResultsTable = function () {
    var tbl = document.getElementById("results");
    var rowNum = 0;
    var cellNum = 0;
    var props = [
        {"name": "Speed Index (ms)","prop":"SpeedIndex"},
        {"name": "First Paint (ms)","prop":"firstPaint"},
        {"name": "First Interactive (ms)","prop":"FirstInteractive"},
        {"name": "Page Load (ms)","prop":"loadTime"},
        {"name": "Fully Loaded (ms)","prop":"fullyLoaded"},
        {"name": "Page Size (B)","prop":"bytesIn"},
        {"name": "Requests","prop":"requestsFull"},
    ];

    /* header */
    var header = tbl.createTHead();
    var row = header.insertRow(rowNum++);
    var cell = row.insertCell(cellNum++);
    cell.innerHTML = "Blocked Domains";

    props.forEach((prop) => {
        var cell = row.insertCell(cellNum++);
        cell.innerHTML = prop.name;
    });
    var compare = false;
    var diff, dir, compareTo, plus;
    window.wpt.tests.forEach((test) => {
        if (rowNum > 1) compare = true;
        row = tbl.insertRow(rowNum++);
        cellNum = 0;
        cell = row.insertCell(cellNum++);
        var blocked = test.blocked;
        if (blocked == "") blocked = " -- baseline -- ";
        cell.innerHTML = `<span class='domain'>${blocked}</span>`;
        props.forEach((prop) => {
            cell = row.insertCell(cellNum++);
            var val = eval('test.result.'+prop.prop);
            if (val) {
                if (prop.name === "Requests") {
                    cell.innerHTML = `<a target="_blank" title="View request map" href="https://requestmap.herokuapp.com/render/${test.testId}?group=thirdparty.category">${val.toLocaleString()}</a>`;
                } else {
                    cell.innerHTML = val.toLocaleString();
                }
            }
            if (compare && val) {
                compareTo = eval('window.wpt.tests[0].result.'+prop.prop);
                diff = val - compareTo;
                plus = "";
                if (diff < 0) {
                    dir = "change-pos";
                } else if (diff > 0) {
                    dir = "change-neg";
                    plus = "+";
                } else {
                    dir = "change-non";
                }
                cell.innerHTML += `<br><span class='change ${dir}'>(${plus}${diff.toLocaleString()})</span>`;
            } else if (!compare) {
                cell.innerHTML += `<br><span class='change change-non'>(-)</span>`;
            }
        });
    });
};

const renderResultsLinks = function() {
    var div = document.getElementById('links');
    var a = document.createElement("a");
    a.href = "https://www.webpagetest.org/video/compare.php?tests="+window.wpt.tests.map((obj) => {return obj.testId;}).join(",")+"&thumbSize=100&ival=100&end=visual";
    a.innerHTML = "View comparison on webpagetest.org";
    a.target = "_blank";
    div.appendChild(a);
}

const statusLoop = function() {
    updateStatus()
    .then(() => {
        var complete = isComplete();
        if (complete) {
            console.log("tests are complete");
            renderResults();
            renderResultsLinks();
        } else {
            renderStatus();
            setTimeout(statusLoop,2000);
        }
    });
};