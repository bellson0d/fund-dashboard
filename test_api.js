async function testFundApi() {
  const fundCode = '001595';
  const timestamp = Date.now();
  
  console.log('=== 测试天天基金API ===');
  console.log('测试基金代码:', fundCode);
  
  // 测试基金基本信息接口
  console.log('\n1. 测试基金基本信息接口...');
  try {
    const gzUrl = `http://fundgz.1234567.com.cn/js/${fundCode}.js?rt=${timestamp}`;
    console.log('请求URL:', gzUrl);
    
    const response = await fetch(gzUrl);
    const text = await response.text();
    console.log('响应状态:', response.status);
    console.log('响应内容(前500字符):', text.slice(0, 500));
    
    // 解析JSONP格式
    const match = text.match(/jsonpgz\((.*)\)/);
    if (match) {
      const data = JSON.parse(match[1]);
      console.log('解析成功:');
      console.log('  基金名称:', data.name);
      console.log('  实时估值:', data.gsz);
      console.log('  日增长率:', data.gszzl + '%');
      console.log('  单位净值:', data.dwjz);
      console.log('  估值时间:', data.gztime);
    }
  } catch (error) {
    console.error('基金基本信息接口测试失败:', error.message);
  }
  
  // 测试基金持仓接口
  console.log('\n2. 测试基金持仓接口...');
  try {
    const pingzhongUrl = `https://fund.eastmoney.com/pingzhongdata/${fundCode}.js?v=${timestamp}`;
    console.log('请求URL:', pingzhongUrl);
    
    const response = await fetch(pingzhongUrl);
    const text = await response.text();
    console.log('响应状态:', response.status);
    console.log('响应内容(前1000字符):', text.slice(0, 1000));
    
    // 解析JS变量
    const codeMatch = text.match(/stockCodes\s*=\s*"([^"]+)"/);
    const nameMatch = text.match(/stockNames\s*=\s*"([^"]+)"/);
    const ratioMatch = text.match(/stockRatios\s*=\s*"([^"]+)"/);
    
    if (codeMatch && nameMatch) {
      const codes = codeMatch[1].split(',');
      const names = nameMatch[1].split(',');
      const ratios = ratioMatch ? ratioMatch[1].split(',').map(r => parseFloat(r)) : [];
      
      console.log('解析成功 - 持仓股票:');
      for (let i = 0; i < Math.min(codes.length, names.length, 10); i++) {
        console.log(`  ${i+1}. ${names[i]} (${codes[i]}) - ${ratios[i] || 'N/A'}%`);
      }
    }
  } catch (error) {
    console.error('基金持仓接口测试失败:', error.message);
  }
  
  console.log('\n=== 测试完成 ===');
}

testFundApi();
