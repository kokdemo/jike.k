// chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
//     alert('yes');
// });

var topic = document.getElementsByClassName('topic-info-main')[0];
var topicName = topic.childNodes[0].innerText;
var tab = document.getElementsByClassName('tab-title')[0];
tab.innerText = topicName + tab.innerText;