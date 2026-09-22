const http = require('http');

function postJson(urlPath, data) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(data);
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: urlPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, body: JSON.parse(body || '{}') });
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

async function testConcurrency() {
    console.log('--- TEST CONCURRENCIA: Lanzar dos RPAs simultáneos ---');
    
    // Iniciar primer RPA en background (no esperar a que termine)
    postJson('/api/buscar-individual', { producto: 'arroz', cantidad: 1, unidad: '500g' })
        .then(r => console.log('[RPA 1 terminado]:', r.statusCode))
        .catch(e => console.log('[RPA 1 error]:', e.message));

    // Esperar 250ms para que el primer RPA adquiera el lock isRpaRunning = true
    await new Promise(r => setTimeout(r, 250));

    // Intentar lanzar el segundo RPA mientras el primero sigue ejecutándose
    console.log('[RPA 2] Intentando lanzar segundo RPA concurrente...');
    const res2 = await postJson('/api/buscar-individual', { producto: 'leche', cantidad: 1, unidad: '1L' });
    console.log('[RPA 2 Respuesta]: Status =', res2.statusCode, '| Mensaje =', res2.body.message);

    if (res2.statusCode === 409 && res2.body.message.includes('ya está')) {
        console.log('>>> TEST CONCURRENCIA EXITOSO: El segundo RPA fue rechazado correctamente con HTTP 409.');
    } else {
        console.error('>>> TEST CONCURRENCIA FALLIDO: No se bloqueó la concurrencia.');
    }
}

testConcurrency().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
