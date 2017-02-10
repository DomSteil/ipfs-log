'use strict'

const Log = require('../src/log')
// const IPFS = require('ipfs-daemon')
const IPFS = require('ipfs-daemon/src/ipfs-node-daemon')

// Metrics
let totalQueries = 0
let seconds = 0
let queriesPerSecond = 0
let lastTenSeconds = 0
let ipfs, log

const queryLoop = () => {
  Log.append(ipfs, log, totalQueries.toString())
    .then((res) => {
      log = res
      totalQueries++
      lastTenSeconds++
      queriesPerSecond++
      setImmediate(queryLoop)
    })
    .catch((e) => console.error(e))
}

let run = (() => {
  console.log('Starting benchmark...')

  ipfs = new IPFS({
    Flags: [],
    Bootstrap: []
  })

  ipfs.on('error', (err) => {
    console.error(err)
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
      console.log(`${queriesPerSecond} queries per second, ${totalQueries} queries in ${seconds} seconds (Entry count: ${log.items.length})`)
      queriesPerSecond = 0
    }, 1000)

    log = Log.create()
    setImmediate(queryLoop)
  })
})()

module.exports = run
