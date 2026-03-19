const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios'); 
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

// 1. 設定 LINE 的鑰匙
const lineConfig = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};
const client = new line.Client(lineConfig);

// 2. 監視器
app.use((req, res, next) => {
  console.log(`[系統連線] 收到來自 ${req.path} 的請求`);
  next();
});

// 3. 測試首頁
app.get('/', (req, res) => {
  res.send('瑞智文教 AI 派師系統中繼站已啟動！');
});

// 4. LINE 接收端
app.post('/webhook', line.middleware(lineConfig), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error('❌ Webhook 處理錯誤：', err);
      res.status(500).end();
    });
});

// 5. 核心邏輯 (改用 Coze v2 直通車 API)
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userMessage = event.message.text;
  const userId = event.source.userId;
  console.log(`📩 收到客戶訊息: ${userMessage}`);

  try {
    console.log('🧠 正在呼叫 Coze 大腦思考中...');
    
    // 步驟 A：改打 Coze v2 API，這個版本會直接回傳答案
    const cozeResponse = await axios.post('https://api.coze.com/open_api/v2/chat', {
      bot_id: process.env.BOT_ID,
      user: userId,
      query: userMessage,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.COZE_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': '*/*'
      }
    });

    // 步驟 B：從 v2 的包裹裡拿出對話陣列
    const messages = cozeResponse.data.messages;
    let aiReplyText = "不好意思，AI 大腦目前有點恍神，請稍後再試。";
    
    // 確認 messages 真的有東西，再把 AI 的回答抓出來
    if (messages && Array.isArray(messages)) {
        const aiAnswerObj = messages.find(msg => msg.type === 'answer');
        if (aiAnswerObj) {
            aiReplyText = aiAnswerObj.content;
        }
    }

    console.log(`✅ Coze 大腦回覆: ${aiReplyText}`);

    // 步驟 C：傳回 LINE
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: aiReplyText
    });

  } catch (error) {
    console.error('❌ 呼叫 Coze API 失敗：', error.response ? error.response.data : error.message);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '系統線路有點忙碌，請稍後再試喔！(工程師正快馬加鞭搶修中)'
    });
  }
}

app.listen(port, () => {
  console.log(`🚀 瑞智派師中繼站伺服器已啟動在 Port ${port}`);
});
