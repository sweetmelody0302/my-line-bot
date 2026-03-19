// 引入我們剛剛安裝的套件
const express = require('express');
const line = require('@line/bot-sdk');
require('dotenv').config();

// 建立一個 Express 伺服器應用程式
const app = express();

// 設定 LINE 的金鑰 (我們稍後會在 Zeabur 填入這些資料)
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

// 建立一個 LINE 客戶端，用來代替我們發送訊息
const client = new line.Client(config);

// 建立一個 Webhook 接收端點。
// 當 LINE 收到訊息時，會把資料送到這個網址 (例如：你的Zeabur網址/webhook)
app.post('/webhook', line.middleware(config), (req, res) => {
  // LINE 可能一次送來多筆事件，我們用 Promise.all 一次處理
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error('Webhook 發生錯誤:', err);
      res.status(500).end();
    });
});

// 這是處理每一筆訊息的核心邏輯
async function handleEvent(event) {
  // 如果傳來的不是文字訊息，我們就不理它 (直接 return null 省額度)
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  // 取得使用者輸入的文字
  const userText = event.message.text;
  console.log(`收到訊息: ${userText}`);

  // 🚨【API 額度守門員】🚨
  // 我們設定一個觸發關鍵字，例如「特助」。
  // 如果群組裡的對話「沒有」包含特助兩個字，機器人就繼續裝死，不消耗額度！
  if (!userText.includes('特助')) {
    return Promise.resolve(null); 
  }

  // 如果有喊「特助」，我們就先準備一段預設的回覆測試看看
  const replyText = '收到！我是特助，中繼站連線成功！下一關我們就可以呼叫 Coze 大腦了！';

  // 建立要回傳給 LINE 的訊息格式
  const message = {
    type: 'text',
    text: replyText,
  };

  // 使用 client.replyMessage 把訊息傳回給原本的群組或聊天室
  // 注意：replyToken 是 LINE 給的一次性回覆憑證，免費且最優先使用
  return client.replyMessage(event.replyToken, message);
}

// 設定伺服器監聽的 Port (Zeabur 會自動指定 PORT 環境變數)
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`中繼站伺服器已經啟動在 Port ${port}`);
});
