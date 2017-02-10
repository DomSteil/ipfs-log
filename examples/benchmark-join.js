'use strict'

const Log = require('../src/log')
// const IPFS = require('ipfs-daemon')
const IPFS = require('ipfs-daemon/src/ipfs-node-daemon')

let ipfs
let log1
let log2

// Metrics
let totalQueries = 0
let seconds = 0
let queriesPerSecond = 0
let lastTenSeconds = 0

const queryLoop = () => {
  const add1 = Log.append(ipfs, log1, 'a' + totalQueries)
  const add2 = Log.append(ipfs, log2, 'b' + totalQueries)

  Promise.all([add1, add2])
    .then((res) => {
      log1 = Log.join(ipfs, res[0], res[1], 60)
      log2 = Log.join(ipfs, res[1], res[0], 60)
      totalQueries++
      lastTenSeconds++
      queriesPerSecond++
      setImmediate(queryLoop)
    })
    .catch((e) => {
      console.error(e)
      process.exit(0)
    })
}

let run = (() => {
  console.log('Starting benchmark...')

  ipfs = new IPFS({
    Flags: [],
    Bootstrap: []
  })

  ipfs.on('error', (err) => {
    console.error(err)
    process.exit(1)
  })

  ipfs.on('ready', () => {
    // Output metrics at 1 second interval
    setInterval(() => {
      seconds++
      if (seconds % 10 === 0) {
        console.log(`--> Average of ${lastTenSeconds / 10} q/s in the last 10 seconds`)
        if (lastTenSeconds === 0) throw new Error('Problems!')
        lastTenSeconds = 0
      }
      console.log(`${queriesPerSecond} queries per second, ${totalQueries} queries in ${seconds} seconds`)
      queriesPerSecond = 0
    }, 1000)

    log1 = Log.create()
    log2 = Log.create()
    queryLoop()
  })
})()

module.exports = run
