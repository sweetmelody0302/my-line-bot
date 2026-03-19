const express = require('express');
const line = require('@line/bot-sdk');
require('dotenv').config();

const app = express();
// 確保優先使用 Render 給的 Port
const port = process.env.PORT || 10000;

// 1. 抓取 LINE 的兩把鑰匙
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

// 2. 裝上監視器：印出所有來敲門的請求
app.use((req, res, next) => {
  console.log(`[監視器] 收到來自 ${req.path} 的請求`);
  next();
});

// 3. 測試伺服器是否活著的網頁通道
app.get('/', (req, res) => {
  res.send('Render 伺服器活著喔！');
});

// 4. LINE Webhook 接收端
app.post('/webhook', line.middleware(config), (req, res) => {
  console.log('✅ 成功收到 LINE 的 Webhook 訊號！');
  
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error('❌ 處理事件時發生嚴重錯誤：', err);
      res.status(500).end();
    });
});

// 5. 處理訊息的邏輯 (暫時不接 Coze，先測試基本回應)
function handleEvent(event) {
  console.log('📩 收到使用者事件：', JSON.stringify(event));
  
  // 如果不是文字訊息，就不理它
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  // 建立 LINE 客戶端
  const client = new line.Client(config);
  
  // 直接回覆測試文字
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: '這是我從 Render 程式碼直接回覆的測試訊息！如果看到這個，代表 LINE 串接 100% 成功了！'
  });
}

// 6. 啟動伺服器
app.listen(port, () => {
  console.log(`🚀 伺服器已成功啟動在 Port ${port}`);
});
