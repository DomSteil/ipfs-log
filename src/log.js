'use strict'

const Entry = require('./entry')
const whilst = require('async/whilst')

const IpfsNotDefinedError = new Error('Ipfs instance not defined')
const LogNotDefinedError = new Error('Log instance not defined')

/** 
 * ipfs-log
 *
 * @example
 * // https://github.com/haadcode/ipfs-log/blob/master/examples/log.js
 * const IPFS = require('ipfs-daemon')
 * const Log  = require('ipfs-log')
 * const ipfs = new IPFS()
 *
 * ipfs.on('ready', () => {
 *   const log1 = Log.create(ipfs, ['one'])
 *   const log2 = Log.create(ipfs, [{ two: 'hello' }, { ok: true }])
 *   const out = Log.join(ipfs, log2, log2)
 *     .collect()
 *     .map((e) => e.payload)
 *     .join('\n')
 *   console.log(out)
 *   // ['one', '{ two: 'hello' }', '{ ok: true }']
 * })
 */
class Log {
  constructor(entries, heads) {
    if (entries && !Array.isArray(entries)) throw new Error('entries argument must be an array')
    if (heads && !Array.isArray(heads)) throw new Error('heads argument must be an array')
    this._entries = entries || []
    this._heads = heads || []
  }

  /**
   * Returns the items in the log
   * @returns {Array<Entry>}
   */
  get items() {
    return this._entries
  }

  /**
   * Returns a list of heads as multihashes
   * @returns {Array<string>}
   */
  get heads() {
    return this._heads
  }

  /**
   * Find an entry
   * @param {string} [hash] The Multihash of the entry as Base58 encoded string
   * @returns {Entry|undefined}
   */
  get(hash) {
    return this.items.find((e) => e.hash === hash)
  }

  /**
   * Returns the log entries as a formatted string
   * @example
   * two
   * └─one
   *   └─three
   * @returns {string}
   */
  toString() {
    return this.items
      .slice()
      .reverse()
      .map((e, idx) => {
        const parents = LogUtils._findParents(this.items, e)
        const len = parents.length
        let padding = new Array(Math.max(len - 1, 0))
        padding = len > 1 ? padding.fill('  ') : padding
        padding = len > 0 ? padding.concat(['└─']) : padding
        return padding.join('') + e.payload
      })
      .join('\n')
  }

  /**
   * Get the log in JSON format
   * @returns {Object<{heads}>}
   */
  toJSON() {
    return { heads: this.heads.slice() }
  }

  /**
   * Get the log as a Buffer
   * @returns {Buffer}
   */
  toBuffer() {
    return new Buffer(JSON.stringify(this.toJSON()))
  }
}

class LogUtils {
  /**
   * Create a new log
   * @param {IPFS} ipfs An IPFS instance
   * @param {Array} [entries] - Entries for this log
   * @param {Array} [heads] - Heads for this log
   * @returns {Log}
   */
  static create(entries, heads) {
    // If entries were given but not the heads, find them
    if (Array.isArray(entries) && !heads) {
      heads = LogUtils._findHeads(entries)
    }

    return new Log(entries, heads)
  }

  static sort(entries, log1, log2) {
      const stack = entries
      const cache = {}
      const res = []

      while(stack.length > 0) {
        const e = stack.shift()

        if (!cache[e.hash]) {
          cache[e.hash] = e

          const indices2 = res.map((f, idx) => {
            return f.next.includes(e.hash) ? idx : -1
          })
          const indices = e.next.map((next) => res.map(e => e.hash).indexOf(next))

          let maxIndex1 = indices.reduce((acc, val) => {
            return acc > val ? acc : val
          }, -1)
          let maxIndex2 = indices2.reduce((acc, val) => {
            return acc > val ? acc : val
          }, -1)

          maxIndex1 = maxIndex1 > -1 ? maxIndex1 + 1 : 0
          maxIndex2 = maxIndex2 > -1 ? maxIndex2 : 0

          let maxIndex = Math.min(maxIndex1, maxIndex2)
          res.splice(maxIndex, 0, e)

          e.next.forEach((f, i) => {
            let a = entries.find((e) => e.hash === f)
            if (log1) a = a ? a : log1.get(f)
            if (log2) a = a ? a : log2.get(f)
            if (a)
              stack.unshift(a)
          })
        }
      }
      return res
    }


  /**
   * Create a new log starting from an entry
   * @param {IPFS} ipfs An IPFS instance
   * @param {string} hash Multihash as Base58 encoded string of the entry to start from
   * @param {Number} [length=-1] How many entries to include. Default: infinite.
   * @param {function(hash, entry, parent, depth)} onProgressCallback 
   * @returns {Promise<Log>}
   */
  static fromEntry(ipfs, hash, length = -1, onProgressCallback) {
    if (!ipfs) throw IpfsNotDefinedError

    return LogUtils.fetchAll(ipfs, hash, length)
    // return LogUtils._fetchRecursive(ipfs, hash, length, 0, null, onProgressCallback)
      .then((items) => {
        // let log = LogUtils.create()
        let sorted = LogUtils.sort(items)
        let log = LogUtils.create(sorted)
        // items.reverse().forEach((e) => LogUtils._insert(ipfs, log, e))
        // log._heads = LogUtils._findHeads(log.items)
        return log
      })
  }

  /**
   * Create a log from multihash
   * @param {IPFS} ipfs - An IPFS instance
   * @param {string} hash - Multihash (as a Base58 encoded string) to create the log from
   * @param {Number} [length=-1] - How many items to include in the log
   * @param {function(hash, entry, parent, depth)} onProgressCallback 
   * @returns {Promise<Log>}
   */
  static fromMultihash(ipfs, hash, length = -1, onProgressCallback) {
    if (!ipfs) throw IpfsNotDefinedError
    if (!hash) throw new Error('Invalid hash: ' + hash)

    return ipfs.object.get(hash, { enc: 'base58' })
      .then((dagNode) => JSON.parse(dagNode.toJSON().data))
      .then((logData) => {
        if (!logData.heads) throw new Error('Not a Log instance')
        // Fetch logs starting from each head entry
        // const allLogs = logData.heads
        //   .sort(LogUtils._compare)
        //   .map((f) => LogUtils.fromEntry(ipfs, f, length, excludeHashes, onProgressCallback))
        // // Join all logs together to one log
        // const joinAll = (logs) => LogUtils.joinAll(ipfs, logs)
        // return Promise.all(allLogs).then(joinAll)
        // console.log(">!<", logData.heads)
        return LogUtils.fetchAll(ipfs, logData.heads, length)
          .then((entries) => {
            let log = LogUtils.create([])
            // entries.reverse().forEach((e) => LogUtils._insert(ipfs, log, e))
            entries.forEach((e) => LogUtils._insert(ipfs, log, e))
            log._heads = logData.heads
            // console.log("HEADS", log._heads, logData.heads)
            return log
            // LogUtils.create(ipfs, entries, logData.heads)
          })
      })
  }

  /**
   * Get the log's multihash
   * @param {IPFS} ipfs An IPFS instance
   * @param {Log} log Log to persist
   * @returns {Promise<string>}
   */
  static toMultihash(ipfs, log) {
    if (!ipfs) throw IpfsNotDefinedError
    if (!log) throw LogNotDefinedError

    if (log.items.length < 1) throw new Error(`Can't serialize an empty log`)
    return ipfs.object.put(log.toBuffer())
      .then((dagNode) => dagNode.toJSON().multihash)
  }

  /**
   * Add an entry to a log
   * @description Adds an entry to the Log and returns a new Log. Doesn't modify the original Log.
   * @memberof Log
   * @static
   * @param {IPFS} ipfs An IPFS instance
   * @param {Log} log - The Log to add the entry to
   * @param {string|Buffer|Object|Array} data - Data of the entry to be added
   *
   * @example
   * const log2 = Log.append(ipfs, log1, 'hello again')
   *
   * @returns {Promise<Log>}
   */
  static append(ipfs, log, data) {
    if (!ipfs) throw IpfsNotDefinedError
    if (!log) throw LogNotDefinedError

    // Create the entry
    return Entry.create(ipfs, data, log.heads)
      .then((entry) => {
        // Add the entry to the previous log entries
        const items = log.items.concat([entry])
        // Set the heads of this log to the latest entry
        const heads = [entry.hash]
        // Create a new log instance
        return new Log(items, heads)
      })
  }

  /**
   * Join two logs
   * 
   * @description Joins two logs returning a new log. Doesn't mutate the original logs.
   *
   * @param {IPFS} [ipfs] An IPFS instance
   * @param {Log} a
   * @param {Log} b
   *
   * @example
   * const log = Log.join(ipfs, log1, log2)
   * 
   * @returns {Log}
   */
  static join(ipfs, a, b, size) {
    if (!ipfs) throw IpfsNotDefinedError
    if (!a || !b) throw LogNotDefinedError
    if (!a.items || !b.items) throw new Error('Log to join must be an instance of Log')

    // If size is not specified, join all entries by default
    size = size ? size : a.items.length + b.items.length

    // Get the heads from both logs and sort them by their IDs
    const getHeadEntries = (log) => {
      return log.heads
      .map((e) => log.get(e))
      .filter((e) => e !== undefined)
    }

    const headsA = getHeadEntries(a)
    const headsB = getHeadEntries(b)
    const heads = headsA.concat(headsB)
      .map((e) => e.hash)
      .sort()

    // Sort which log should come first based on heads' IDs
    const aa = headsA[0] ? headsA[0].hash : null
    const bb = headsB[0] ? headsB[0].hash : null
    const isFirst = aa < bb
    const log1 = isFirst ? a : b
    const log2 = isFirst ? b : a

    // Cap the size of the entries
    const oldEntries = log1.items.slice(-size)
    const newEntries = log2.items.slice(-size)

    // console.log("===========++")
    // const sorted = sort(headsA.concat(headsB), log1, log2)
    const hh = headsA.concat(headsB)
      .sort((a, b) => a.hash < b.hash)
      // .filter((e) => e !== undefined)

    const sorted = LogUtils.sort(hh, log1, log2)
    // const sorted = sort(oldEntries.concat(newEntries))
    // console.log("===========++")
    // console.log(sorted.map(e => e.payload))
    // console.log("===========--")

    // Create a new log instance
    // let result = LogUtils.create()
    let result = LogUtils.create(sorted)
    // let result = LogUtils.create(sorted, heads)
    // console.log(oldEntries.map(e => e.payload))
    // Insert each entry to the log
    // console.log("1---------")
    // oldEntries.reverse().forEach((e) => LogUtils._insert(ipfs, result, e, true))
    // console.log("2---------")
    // newEntries.reverse().forEach((e) => LogUtils._insert(ipfs, result, e, true))
    // console.log("3---------")

    result._entries = result._entries.slice(0, size)
    // result._heads = LogUtils._findHeads(sorted)
    // result._heads.forEach((f) => console.log(result.get(f)))
    // console.log(result.items.length, size)
    return result
  }

  /**
   * Join multiple logs
   * @param {IPFS} [ipfs] An IPFS instance
   * @param {Array<Log>} logs
   * @returns {Log}
   */
  static joinAll(ipfs, logs, length) {
    if (!ipfs) throw IpfsNotDefinedError

    return logs.reduce((log, val, i) => {
      if (!log) return val
      return LogUtils.join(ipfs, log, val, length)
    }, null)
  }

  /**
   * Expand the size of the log
   * @param {IPFS} [ipfs] An IPFS instance
   * @param {Log} log
   * @param {Number} length
   * @param {function(hash, entry, parent, depth)} onProgressCallback
   * @returns {Promise<Log>}
   */
  static expand(ipfs, log, length = -1, onProgressCallback) {
    if (!ipfs) throw IpfsNotDefinedError
    if (!log) throw LogNotDefinedError
    // Find tails (entries that point to an entry that is not in the log)
    const nexts = log.items.slice().reduce((res, e) => res.concat(e.next), [])
    const tails = nexts.slice()
      .filter((e) => nexts.includes(e))
      .sort((a, b) => a.hash < b.hash)

    // Fetch entries starting from all tail entries
    const amount = length > -1 ? length - log.items.length : -1
    return LogUtils.fetchAll(ipfs, tails, amount, log.items.map((e) => e.hash))
      .then((entries) => {
        // let result = LogUtils.create(entries)
        // console.log(entries.length)
        // result = LogUtils.join(ipfs, log, result, length)
        // let result = LogUtils.create()
        // entries.reverse().forEach((e) => LogUtils._insert(ipfs, result, e))
        // result._heads = LogUtils._findHeads(result.items)
        // return LogUtils.join(ipfs, log, result, length)
        const sorted = LogUtils.sort(log.items.slice().reverse().concat(entries))
        let result = LogUtils.create(sorted)
        return result
        // return LogUtils.join(ipfs, log, result, length)
      })
    // Join all logs together to one log
    // const joinAll = (logs) => LogUtils.joinAll(ipfs, logs.concat([log]), length)
    // Create all logs and join them
    // return Promise.all(getLog).then(joinAll)
  }

  /**
   * Insert an entry to the log
   * @private
   * @param {Entry} entry Entry to be inserted
   * @returns {Entry}
   */
  static _insert(ipfs, log, entry, debug) {
    if (!ipfs) throw IpfsNotDefinedError
    if (!log) throw LogNotDefinedError

    const hashes = log.items.map((f) => f.hash)
    // If entry is already in the log, don't insert
    if (hashes.includes(entry.hash)) return entry
    // Find the item's parents' indices
    const indices2 = log.items.map((f, idx) => {
      // console.log(f.payload, f.next, entry.hash, f.next.includes(entry.hash))
      return f.next.includes(entry.hash) ? idx - 1 : -1
    })
    // console.log("22", indices2)
    const indices = entry.next.map((next) => hashes.indexOf(next)).concat(indices2)
    // Find the largest index (latest parent)
    let index = indices.length > 0 
      ? Math.max(Math.max.apply(null, indices) + 1, 0) 
      // ? Math.max.apply(null, indices)
      : 0

    // if (Math.max.apply(null, indices) === Math.max.apply(null, indices2))
    //   index--

    // Insert
    log.items.splice(index, 0, entry)
    // if (debug)
    //   console.log(index, Math.max.apply(null, indices), Math.max.apply(null, indices2), entry.payload, entry.hash, entry.next)
    return entry
  }

  /**
   * Fetch log entries recursively
   * @private
   * @param {IPFS} [ipfs] An IPFS instance
   * @param {string} [hash] Multihash of the entry to fetch
   * @param {string} [parent] Parent of the node to be fetched
   * @param {Object} [all] Entries to skip
   * @param {Number} [amount=-1] How many entries to fetch.
   * @param {Number} [depth=0] Current depth of the recursion
   * @param {function(hash, entry, parent, depth)} onProgressCallback
   * @returns {Promise<Array<Entry>>}
   */
  // static _fetchRecursive(ipfs, hash, all = {}, amount = -1, depth = 0, parent = null, onProgressCallback = () => {}) {
  //   if (!ipfs) throw IpfsNotDefinedError

  //   // If the given hash is already fetched
  //   // or if we're at maximum depth, return
  //   if (all[hash] || (depth >= amount && amount > 0)) {
  //     return Promise.resolve([])
  //   }
  //   // Create the entry and add it to the result
  //   // console.log("...", depth)
  //   return Entry.fromMultihash(ipfs, hash)
  //     .then((entry) => {
  //       all[hash] = entry
  //       onProgressCallback(hash, entry, parent, depth)
  //       const fetch = (hash, idx) => LogUtils._fetchRecursive(ipfs, hash, all, amount - idx, depth + 1, entry, onProgressCallback)
  //       return mapSeries(entry.next, fetch)
  //         .then((res) => res.concat([entry]))
  //         .then((res) => res.reduce((a, b) => a.concat(b), [])) // flatten the array
  //     })
  // }

  static fetchAll(ipfs, hashes, amount, exclude = []) {
    let result = []
    let loadingQueue = Array.isArray(hashes) ? hashes.slice() : [hashes]

    const shouldFetchMore = () => {
      // console.log(result.length, loadingQueue.length)
      return loadingQueue.length > 0
        && (result.length < amount || amount === -1)
    }

    return new Promise((resolve, reject) => {
      whilst(
        shouldFetchMore,
        (cb) => {
          // console.log(loadingQueue)
          const hash = loadingQueue.shift()
          if (exclude.concat(result.map((e) => e.hash)).includes(hash)) {
            cb(null, result)
          } else {
            // const hash = loadingQueue.shift()
            Entry.fromMultihash(ipfs, hash)
              .then((e) => {
                // console.log("\nentry:\n", e)
                // console.log("entry:", e.payload)
                // console.log("\nnext\n", e.next)
                // TODO: insert after parent?
                const idx = loadingQueue.indexOf(hash) - 1
                e.next.forEach((f, i) => loadingQueue.splice(idx + i, 0, f))
                
                // loadingQueue = loadingQueue.concat(e.next)
                result.push(e)
                // console.log("\nload next:\n", loadingQueue)
                cb(null, result)
                // return { items: result, queue: loadingQueue }
              })
          }
        },
        (err, res) => {
          // console.log(res)
          if (err) reject(err)
          resolve(result)
        }
      )      
    })
  }

  // static processQueue(result, loadingQueue) {
  //   if (loadingQueue > 0) {
  //     console.log(loadingQueue)
  //     const hash = loadingQueue.shift()
  //     console.log(hash)
  //     return Entry.fromMultihash(hash)
  //       .then((e) => {
  //         console.log(e)
  //         loadingQueue.concat(e.next)
  //         result.push(e)
  //         return { items: result, queue: loadingQueue }
  //       })
  //   }
  // }

  /**
   * Find heads of a log
   * @private
   * @param {Log} log
   * @returns {Array<Entry>}
   */
  static _findHeads(entries) {
    return entries.slice()
      .reverse()
      .filter((f) => !LogUtils._isReferencedInChain(entries, f))
      .map((f) => f.hash)
      .sort(LogUtils._compare)
  }

  /**
   * Check if an entry is referenced by another entry in the log
   * @private
   * @param {log} [log] Log to search an entry from
   * @param {Entry} [entry] Entry to search for
   * @returns {boolean}
   */
  static _isReferencedInChain(entries, entry) {
    return entries.slice().reverse().find((e) => Entry.hasChild(e, entry)) !== undefined
  }

  /**
   * Find entry's parents
   * @private
   * @description Returns entry's parents as an Array up to the root entry
   * @param {Log} [log] Log to search parents from
   * @param {Entry} [entry] Entry for which to find the parents
   * @returns {Array<Entry>}
   */
  static _findParents(entries, entry) {
    let stack = []
    let parent = entries.find((e) => Entry.hasChild(e, entry))
    let prev = entry
    while (parent) {
      stack.push(parent)
      prev = parent
      parent = entries.find((e) => Entry.hasChild(e, prev))
    }
    return stack
  }

  /**
   * Internal compare function
   * @private
   * @returns {boolean}
   */
  static _compare(a, b) {
    return a < b
  }
}

module.exports = LogUtils
