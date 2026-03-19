const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios'); // 負責幫我們打電話給 Coze 大腦
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

// 1. 設定 LINE 的兩把鑰匙
const lineConfig = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};
const client = new line.Client(lineConfig);

// 2. 裝上監視器，方便後台除錯
app.use((req, res, next) => {
  console.log(`[系統連線] 收到來自 ${req.path} 的請求`);
  next();
});

// 3. 測試伺服器是否存活的網頁
app.get('/', (req, res) => {
  res.send('瑞智文教 AI 派師系統中繼站已啟動！');
});

// 4. LINE 傳遞訊息過來的專屬通道 (Webhook)
app.post('/webhook', line.middleware(lineConfig), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error('❌ Webhook 處理發生嚴重錯誤：', err);
      res.status(500).end();
    });
});

// 5. 核心邏輯：收到 LINE 訊息 -> 丟給 Coze -> 把 Coze 的回答傳回 LINE
async function handleEvent(event) {
  // 如果不是文字訊息，就忽略
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userMessage = event.message.text;
  const userId = event.source.userId;
  console.log(`📩 收到客戶訊息: ${userMessage}`);

  try {
    // 步驟 A：打電話給 Coze API (使用 Coze v3 格式)
    console.log('🧠 正在呼叫 Coze 大腦思考中...');
    
    const cozeResponse = await axios.post('https://api.coze.com/v3/chat', {
      bot_id: process.env.BOT_ID,
      user_id: userId,
      stream: false,
      additional_messages: [
        {
          role: 'user',
          content: userMessage,
          content_type: 'text'
        }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.COZE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    // 步驟 B：從 Coze 的回傳資料中，把 AI 說的話挖出來
    // Coze 會回傳一個陣列，我們要過濾出 type 為 'answer' 的對話內容
    const messages = cozeResponse.data.data;
    const aiAnswerObj = messages.find(msg => msg.type === 'answer');
    
    let aiReplyText = "不好意思，AI 大腦目前有點恍神，請稍後再試。";
    if (aiAnswerObj && aiAnswerObj.content) {
        aiReplyText = aiAnswerObj.content;
    }

    console.log(`✅ Coze 大腦回覆: ${aiReplyText}`);

    // 步驟 C：把 AI 的回答傳回給使用者的 LINE
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: aiReplyText
    });

  } catch (error) {
    // 如果發生錯誤，把詳細死因印在 Render 的 Logs 裡
    console.error('❌ 呼叫 Coze API 失敗，詳細錯誤原因：', error.response ? error.response.data : error.message);
    
    // 傳送錯誤提示給使用者
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '系統線路有點忙碌，請稍後再試喔！(工程師正快馬加鞭搶修中)'
    });
  }
}

// 6. 啟動伺服器
app.listen(port, () => {
  console.log(`🚀 瑞智派師中繼站伺服器已啟動在 Port ${port}`);
});
