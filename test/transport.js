const { test } = require('ava')
const Bishop = require('bishop')
const request = require('request-promise')
const transport = require(process.env.PWD)
const Promise = require('bluebird')

let port = 9000
const getNextPort = () => ++port

test('default answer', async t => {
  const bishop = new Bishop()
  const port = getNextPort()

  await bishop.use(transport, {
    name: 'test',
    defaultResponse: {
      some: 'data'
    },
    listenPort: port
  })
  const res = await request(`http://localhost:${port}`)
  const exp = JSON.stringify({ some: 'data', name: 'http' })
  t.deepEqual(res, exp)
})

test('client-server interaction', async t => {
  const bishopServer = new Bishop()
  const bishopClient = new Bishop()
  const port = getNextPort()

  await bishopClient.use(transport, {
    name: 'http-client',
    remote: `http://localhost:${port}`,
    pattern: 'some:stuff'
  })
  await bishopServer.use(transport, {
    name: 'http-server',
    listenPort: port,
  })
  bishopServer.add('some:stuff', () => 'hello')
  t.is(await bishopClient.act('some:stuff, with:stuff'), 'hello')
})

test('ensure timeouts are inherited', async t => {
  const bishopServer = new Bishop()
  const bishopClient = new Bishop({
    timeout: 100 // default timeout
  })
  const port = getNextPort()

  await bishopServer.use(transport, {
    name: 'http-server',
    listenPort: port,
  })
  await bishopClient.use(transport, {
    timeout: 200, // redefine default timeout
    name: 'http-client',
    remote: `http://localhost:${port}`,
    pattern: 'some:stuff'
  })
  bishopServer.add('some:stuff', async (message, headers) => {
    await Promise.delay(message.delay || 0)
    return {
      timeout: parseInt(headers.timeout, 10)
    }
  })
  const res1 = await bishopClient.actRaw('some:stuff')
  t.is(res1.headers.timeout, 200, 'should rewrite default timeout')

  const res2 = await bishopClient.actRaw('some:stuff, $timeout:201')
  t.is(res2.headers.timeout, 201, 'should take timeout from query if set')

  // 2do: pass default options to bishop from transport
  // const res3 = await bishopClient.actRaw('some:stuff, delay:150')
  // t.is(res3.headers.timeout, 200, 'should use redefined timeout and not throw')

  await t.throws(bishopClient.act('some:stuff, delay:210'))

})

test('handle remote error', async t => {
  const bishopServer = new Bishop()
  const bishopClient = new Bishop()
  const port = getNextPort()

  await bishopClient.use(transport, {
    name: 'http-client',
    remote: `http://localhost:${port}`,
    pattern: 'some:stuff'
  })
  await bishopServer.use(transport, {
    name: 'http-server',
    listenPort: port,
  })
  bishopServer.add('some:stuff', () => {
    throw new Error('user error')
  })

  await t.throws(bishopClient.act('some:stuff, with:error'), /user error/)
})

test('handle network error', async t => {
  const bishopClient = new Bishop()
  const port = getNextPort()

  await bishopClient.use(transport, {
    name: 'http-client',
    remote: `http://localhost:${port}`,
    pattern: 'some:stuff'
  })
  await t.throws(bishopClient.act('some:stuff, with:error'), /ECONNREFUSED/)
})
