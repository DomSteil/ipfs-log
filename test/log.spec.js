'use strict'

const assert = require('assert')
const async = require('asyncawait/async')
const await = require('asyncawait/await')
const rmrf = require('rimraf')
const IpfsNodeDaemon = require('ipfs-daemon/src/ipfs-node-daemon')
const IpfsNativeDaemon = require('ipfs-daemon/src/ipfs-native-daemon')
const Log = require('../src/log.js')
const Entry = require('../src/entry')
const bigLogString = require('./big-log.fixture.js')

const dataDir = './ipfs'

let ipfs, ipfsDaemon

const last = (arr) => {
  return arr[arr.length - 1]
}

[IpfsNodeDaemon].forEach((IpfsDaemon) => {
// [IpfsNodeDaemon, IpfsNativeDaemon].forEach((IpfsDaemon) => {

  describe('Log', function() {
    this.timeout(60000)

    before((done) => {
      rmrf.sync(dataDir)
      ipfs = new IpfsDaemon({ IpfsDataDir: dataDir })
      ipfs.on('error', done)
      ipfs.on('ready', () => done())
    })

    after(() => {
      ipfs.stop()
      rmrf.sync(dataDir)
    })

    describe('create', async(() => {
      it('creates an empty log', async(() => {
        const log = Log.create()
        assert.notEqual(log._entries, null)
        assert.notEqual(log._heads, null)
      }))

      it('sets items if given as params', async(() => {
        const one = await(Entry.create(ipfs, 'entryA'))
        const two = await(Entry.create(ipfs, 'entryB'))
        const three = await(Entry.create(ipfs, 'entryC'))
        const log = Log.create([one, two, three])
        assert.equal(log.items.length, 3)
        assert.equal(log.items[0].payload, 'entryA')
        assert.equal(log.items[1].payload, 'entryB')
        assert.equal(log.items[2].payload, 'entryC')
      }))

      it('sets heads if given as params', async(() => {
        const one = await(Entry.create(ipfs, 'entryA'))
        const two = await(Entry.create(ipfs, 'entryB'))
        const three = await(Entry.create(ipfs, 'entryC'))
        const log = Log.create([one, two, three], [three.hash])
        assert.equal(log.heads.length, 1)
        assert.equal(log.heads[0], 'QmUEAST3QbiJy6eTVoigdrgj6VfTAxXk3YnsbCi31v9F5b')
      }))

      it('finds heads if heads not given as params', async(() => {
        const one = await(Entry.create(ipfs, 'entryA'))
        const two = await(Entry.create(ipfs, 'entryB'))
        const three = await(Entry.create(ipfs, 'entryC'))
        const log = Log.create([one, two, three])
        assert.equal(log.heads.length, 3)
        assert.equal(log.heads[0], 'Qma5h6j3iNWjtpaEHyZ6UxVDLf4WVvwx7gNSjQh1L3Xt59')
        assert.equal(log.heads[1], 'QmZopmZdpyXmJ81a49Y339e52SL7m8XXnKUNrSiU5wmUY5')
        assert.equal(log.heads[2], 'QmUEAST3QbiJy6eTVoigdrgj6VfTAxXk3YnsbCi31v9F5b')
      }))

      it('throws an error if ipfs is not provided', async(() => {
        try {
          const log = Log.create()
        } catch(e) {
          assert.equal(e.message, 'Ipfs instance not defined')
        }
      }))
    }))

    describe('toString', async(() => {
      let log
      const expectedData = "five\n└─four\n  └─three\n    └─two\n      └─one"

      beforeEach(async(() => {
        log = Log.create()
        log = await(Log.append(ipfs, log, "one"))
        log = await(Log.append(ipfs, log, "two"))
        log = await(Log.append(ipfs, log, "three"))
        log = await(Log.append(ipfs, log, "four"))
        log = await(Log.append(ipfs, log, "five"))
      }))

      it('returns a nicely formatted string', () => {
        assert.equal(log.toString(), expectedData)
        console.log(log.toString())
      })
    }))

    describe('serialize', async(() => {
      let log
      const expectedData = {
        heads: [
          'QmQG1rPMjt1RQPQTu6cJfSMSS8GddcSw9GxLkVtRB32pMD',
        ]
      }

      beforeEach(async(() => {
        log = Log.create()
        log = await(Log.append(ipfs, log, "one"))
        log = await(Log.append(ipfs, log, "two"))
        log = await(Log.append(ipfs, log, "three"))
      }))

      describe('toJSON', () => {
        it('returns the log in JSON format', () => {
          assert.equal(JSON.stringify(log.toJSON()), JSON.stringify(expectedData))
        })
      })

      describe('toBuffer', () => {
        it('returns the log as a Buffer', () => {
          assert.deepEqual(log.toBuffer(), new Buffer(JSON.stringify(expectedData)))
        })
      })

      describe('toMultihash', async(() => {
        it('returns the log as ipfs hash', async(() => {
          const expectedHash = 'QmUfEy11syU6DxkAdnQyCmgrmeoZz5xV3TW2KYmJ6YidnT'
          let log = Log.create()
          log = await(Log.append(ipfs, log, 'one'))
          const hash = await(Log.toMultihash(ipfs, log))
          assert.equal(hash, expectedHash)
        }))

        it('log serialized to ipfs contains the correct data', async(() => {
          const expectedData = { heads: ["QmUrqiypsLPAWN24Y3gHarmDTgvW97bTUiXnqN53ySXM9V"] }
          const expectedHash = 'QmUfEy11syU6DxkAdnQyCmgrmeoZz5xV3TW2KYmJ6YidnT'
          let log = Log.create()
          log = await(Log.append(ipfs, log, 'one'))
          const hash = await(Log.toMultihash(ipfs, log))
          assert.equal(hash, expectedHash)
          const res = await(ipfs.object.get(hash, { enc: 'base58' }))
          const result = JSON.parse(res.toJSON().data.toString())
          assert.equal(result.heads.length, expectedData.heads.length)
        }))

        it('throws an error if ipfs is not defined', () => {
          let err
          try {
            Log.toMultihash()
          } catch (e) {
            err = e
          }
          assert.notEqual(err, null)
          assert.equal(err.message, 'Ipfs instance not defined')
        })

        it('throws an error if log is not defined', () => {
          let err
          try {
            Log.toMultihash(ipfs)
          } catch (e) {
            err = e
          }
          assert.notEqual(err, null)
          assert.equal(err.message, 'Log instance not defined')
        })
      }))

      describe('fromMultihash', async(() => {
        it('creates an empty log from ipfs hash', async(() => {
          const expectedData = { heads: ['QmUrqiypsLPAWN24Y3gHarmDTgvW97bTUiXnqN53ySXM9V'] }
          let log = Log.create()
          log = await(Log.append(ipfs, log, 'one'))
          const hash = await(Log.toMultihash(ipfs, log))
          const res = await(Log.fromMultihash(ipfs, hash))
          assert.equal(JSON.stringify(res.toJSON()), JSON.stringify(expectedData))
        }))

        it('creates a log from ipfs hash', async(() => {
          const hash = await(Log.toMultihash(ipfs, log))
          const res = await(Log.fromMultihash(ipfs, hash))
          assert.equal(res.items.length, 3)
          assert.equal(res.items[0].payload, 'one')
          assert.equal(res.items[1].payload, 'two')
          assert.equal(res.items[2].payload, 'three')
        }))

        it('creates a log from ipfs hash that has three heads', async(() => {
          let log1 = Log.create()
          let log2 = Log.create()
          let log3 = Log.create()
          log1 = await(Log.append(ipfs, log1, "one"))
          log2 = await(Log.append(ipfs, log2, "two"))
          log3 = await(Log.append(ipfs, log3, "three"))
          const log4 = Log.join(ipfs, log1, log2)
          const log5 = Log.join(ipfs, log4, log3)
          const hash = await(Log.toMultihash(ipfs, log5))
          const res = await(Log.fromMultihash(ipfs, hash))
          assert.equal(res.items.length, 3)
          assert.equal(res._heads.length, 3)
          assert.equal(res.items[2].payload, 'three')
          assert.equal(res.items[1].payload, 'one')
          assert.equal(res.items[0].payload, 'two')
        }))

        it('creates a log from ipfs hash up to a size limit', async(() => {
          const amount = 100
          const size = amount / 2
          let log = Log.create()
          for (let i = 0; i < amount; i ++) {
            log = await(Log.append(ipfs, log, i.toString()))
          }
          const hash = await(Log.toMultihash(ipfs, log))
          const res = await(Log.fromMultihash(ipfs, hash, size))
          assert.equal(res.items.length, size)
        }))

        it('creates a log from ipfs hash up without size limit', async(() => {
          const amount = 100
          let log = Log.create()
          for (let i = 0; i < amount; i ++) {
            log = await(Log.append(ipfs, log, i.toString()))
          }
          const hash = await(Log.toMultihash(ipfs, log))
          const res = await(Log.fromMultihash(ipfs, hash, -1))
          assert.equal(res.items.length, amount)
        }))

        it('throws an error if ipfs is not defined', () => {
          let err
          try {
            const log = Log.fromMultihash()
          } catch (e) {
            err = e
          }
          assert.notEqual(err, null)
          assert.equal(err.message, 'Ipfs instance not defined')
        })

        it('throws an error when data from hash is not instance of Log', async(() => {
          try {
            await(Log.fromMultihash(ipfs, 'QmUrqiypsLPAWN24Y3gHarmDTgvW97bTUiXnqN53ySXM9V'))
          } catch(e) {
            assert.equal(e.message, 'Not a Log instance')
          }
        }))

        it('throws an error if data from hash is not valid JSON', async(() => {
          const res = await(ipfs.object.put(new Buffer('hello')))
          try {
            await(Log.fromMultihash(ipfs, res.toJSON().multihash))
          } catch(e) {
            assert.equal(e.message, 'Unexpected token h in JSON at position 0')
          }
        }))

        it('onProgress callback is fired for each entry', async(() => {
          const amount = 100
          let log = Log.create()
          for (let i = 0; i < amount; i ++) {
            log = await(Log.append(ipfs, log, i.toString()))
          }

          const items = log.items
          let i = 0
          let prevDepth = 0
          const callback = (hash, entry, parent, depth) => {
            assert.notEqual(entry, null)
            assert.equal(hash, items[items.length - i - 1].hash)
            assert.equal(entry.hash, items[items.length - i - 1].hash)
            assert.equal(entry.payload, items[items.length - i - 1].payload)
            assert.equal(depth, i)

            if (i > 0) {
              assert.equal(parent.payload, items[items.length - i].payload)
            }

            i ++
            prevDepth = depth
          }

          const hash = await(Log.toMultihash(ipfs, log))
          const res = await(Log.fromMultihash(ipfs, hash, -1, callback))
        }))

      }))
    }))

    describe('items', () => {
      it('returns all entrys in the log', async(() => {
        let log = Log.create()
        let items = log.items
        assert.equal(log.items instanceof Array, true)
        assert.equal(log.items.length, 0)
        log = await(Log.append(ipfs, log, "hello1"))
        log = await(Log.append(ipfs, log, "hello2"))
        log = await(Log.append(ipfs, log, "hello3"))
        assert.equal(log.items instanceof Array, true)
        assert.equal(log.items.length, 3)
        assert.equal(log.items[0].payload, 'hello1')
        assert.equal(log.items[1].payload, 'hello2')
        assert.equal(log.items[2].payload, 'hello3')
      }))
    })

    describe('append', () => {
      it('adds an item to an empty log', async(() => {
        let log1 = Log.create()
        const log2 = await(Log.append(ipfs, log1, "hello1"))
        assert.equal(log2.items.length, 1)
        assert.equal(log2.items[0].payload, 'hello1')
      }))

      it('doesn\'t modify original log', async(() => {
        let log1 = Log.create()
        const log2 = await(Log.append(ipfs, log1, "hello1"))
        assert.equal(log1.items.length, 0)
      }))

      it('copies the previous entries', async(() => {
        let log1 = Log.create()
        const log2 = await(Log.append(ipfs, log1, "hello1"))
        const log3 = await(Log.append(ipfs, log2, "hello2"))
        assert.equal(log3.items[0].hash, log2.items[0].hash)
      }))

      it('has the right heads after append', async(() => {
        let log1 = Log.create()
        const log2 = await(Log.append(ipfs, log1, "hello1"))
        const log3 = await(Log.append(ipfs, log2, "hello2"))
        assert.equal(log2.heads.length, 1)
        assert.equal(log3.heads.length, 1)
        assert.equal(log2.heads[0], 'QmYn5fAYEfcGANPsptDwCCBR3YSSZPnGR99cddhREyKbrB')
        assert.equal(log3.heads[0], 'QmcVjisTxbi95ALpraaWpEignwsxRarAr3aJXwNmM2wpVU')
        assert.equal(last(log3.items).next[0], 'QmYn5fAYEfcGANPsptDwCCBR3YSSZPnGR99cddhREyKbrB')
      }))

      it('adds 100 items to a log', async(() => {
        const amount = 100
        let log = Log.create()

        for(let i = 1; i <= amount; i ++) {
          log = await(Log.append(ipfs, log, "hello" + i))
        }

        const entry = last(log.items)
        assert.equal(log.items.length, amount)
        assert.equal(entry.payload, 'hello' + amount)
        assert.notEqual(entry.next.length, 0)
      }))

      it('throws an error if ipfs is not defined', () => {
        let err
        try {
          Log.append()
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Ipfs instance not defined')
      })

      it('throws an error if log is not defined', () => {
        let err
        try {
          Log.append(ipfs)
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Log instance not defined')
      })
    })

    describe.skip('joinAll', () => {
    })

    describe('join', () => {
      let log1, log2, log3, log4

      beforeEach(async(() => {
        log1 = Log.create()
        log2 = Log.create()
        log3 = Log.create()
        log4 = Log.create()
      }))

      it('joins logs', async(() => {
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 100
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await(Entry.create(ipfs, 'entryA' + i, [prev1]))
          const n2 = await(Entry.create(ipfs, 'entryB' + i, [prev2, n1]))
          const n3 = await(Entry.create(ipfs, 'entryC' + i, [prev3, n1, n2]))
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        const logA = await(Log.fromEntry(ipfs, last(items2).hash))
        const logB = await(Log.fromEntry(ipfs, last(items3).hash))
        assert.equal(logA.items.length, items2.length + items1.length)
        assert.equal(logB.items.length, items3.length + items2.length + items1.length)

        const log = Log.join(ipfs, logA, logB)

        assert.equal(log.items.length, items3.length + items2.length + items1.length)
        // The last entry, 'entryC100', should be the only head 
        // (it points to entryB100, entryB100 and entryC99)
        assert.equal(log.heads.length, 1)
      }))

      it('throws an error if ipfs is not defined', () => {
        let err
        try {
          Log.join()
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Ipfs instance not defined')
      })

      it('throws an error if passed argument is not an instance of Log', () => {
        let err
        try {
          Log.join(ipfs, log1, {})
        } catch(e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Log to join must be an instance of Log')
      })

      it('joins only unique items', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log1 = Log.join(ipfs, log1, log2)
        log1 = Log.join(ipfs, log1, log2)

        assert.equal(log1.items.length, 4)
        assert.equal(log1.items[2].payload, 'helloB1')
        assert.equal(log1.items[2].hash, 'QmZDQ6FGJ1dAUogJK73Hm9TZmTe9GYx6VJYNgnh7C3cTD1')
        assert.equal(log1.items[3].payload, 'helloB2')
        assert.equal(log1.items[3].hash, 'Qmcn8T7WfjLd73tUpRRwYGtKc2UwdAD5sCfWYRepsbWUo3')
        assert.equal(log1.items[0].payload, 'helloA1')
        assert.equal(log1.items[0].hash, 'QmQjjAwSt8qQQTQ52Kt3qMvS5squGiiEvrSRrkxYYMY3k2')
        assert.equal(log1.items[1].payload, 'helloA2')
        assert.equal(log1.items[1].hash, 'QmYFAWWAPXkyQuND7P8Fm2aLgTH7eAA44wYX8EeaYVGom9')

        const item = last(log1.items)
        assert.equal(item.next.length, 1)
        assert.equal(item.next[0], 'QmZDQ6FGJ1dAUogJK73Hm9TZmTe9GYx6VJYNgnh7C3cTD1')
      }))

      it('joins logs two ways', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log1 = Log.join(ipfs, log1, log2)
        log2 = Log.join(ipfs, log2, log1)

        const lastItem1 = last(log1.items)
        assert.equal(log1.items.length, 4)
        assert.equal(lastItem1.payload, 'helloB2')

        const lastItem2 = last(log2.items)
        assert.equal(log2.items.length, 4)
        assert.equal(lastItem2.payload, 'helloB2')
      }))

      it('doesn\'t change original logs on join', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        const log3 = Log.join(ipfs, log1, log2)
        const log4 = Log.join(ipfs, log2, log1)
        assert.equal(log1.items.length, 1)
        assert.equal(log2.items.length, 1)
        assert.equal(last(log1.items).payload, 'helloA1')
        assert.equal(last(log2.items).payload, 'helloB1')
        assert.equal(log3.items.length, 2)
        assert.equal(log4.items.length, 2)
        assert.equal(last(log3.items).payload, 'helloB1')
        assert.equal(last(log4.items).payload, 'helloB1')
      }))

      it('joins logs twice', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = Log.join(ipfs, log2, log1)

        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log2 = Log.join(ipfs, log2, log1)

        const expectedData = [ 
          'helloA2', 'helloB1', 'helloA1', 'helloB2'
        ]

        assert.equal(log2.items.length, 4)
        assert.deepEqual(log2.items.map((e) => e.payload), expectedData)
      }))

      it('joins 4 logs to one', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))
        log4 = await(Log.append(ipfs, log4, "helloD1"))
        log4 = await(Log.append(ipfs, log4, "helloD2"))
        log1 = Log.join(ipfs, log1, log2)
        log1 = Log.join(ipfs, log1, log3)
        log1 = Log.join(ipfs, log1, log4)

        const expectedData = [ 
          'helloC1', 'helloC2', 'helloD1', 'helloD2',
          'helloA1', 'helloA2', 'helloB1', 'helloB2' 
        ]

        assert.equal(log1.items.length, 8)
        assert.deepEqual(log1.items.map(e => e.payload), expectedData)
      }))

      it('joins logs from 4 logs', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = Log.join(ipfs, log1, log2)
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = Log.join(ipfs, log2, log1)
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log1 = Log.join(ipfs, log1, log3)
        log3 = Log.join(ipfs, log3, log1)
        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))
        log1 = Log.join(ipfs, log1, log3)
        log1 = Log.join(ipfs, log1, log2)
        log4 = await(Log.append(ipfs, log4, "helloD1"))
        log4 = await(Log.append(ipfs, log4, "helloD2"))
        log4 = Log.join(ipfs, log4, log2)
        log4 = Log.join(ipfs, log4, log1)
        log4 = Log.join(ipfs, log4, log3)
        log4 = await(Log.append(ipfs, log4, "helloD3"))
        log4 = await(Log.append(ipfs, log4, "helloD4"))

        // const expectedData = [
        //   'helloD4', 'helloD3', 'helloD2', 'helloD1', 'helloB2',
        //   'helloB1', 'helloC2', 'helloC1', 'helloA2', 'helloA1'
        // ]
        const expectedData = [
          'helloD4', 'helloD3', 'helloC2', 'helloC1', 'helloA2', 
          'helloA1', 'helloB2', 'helloB1', 'helloD2', 'helloD1'
        ]

        console.log(log4.toString())
        assert.equal(log4.items.length, 10)
        assert.deepEqual(log4.items.map((e) => e.payload).reverse(), expectedData)
      }))
    })

    describe('expand', () => {
      it('expands the log', async(() => {
        const log1 = Log.create()
        const log2 = Log.create()
        const log3 = Log.create()
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 100
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await(Entry.create(ipfs, 'entryA' + i, [prev1]))
          const n2 = await(Entry.create(ipfs, 'entryB' + i, [prev2, n1]))
          const n3 = await(Entry.create(ipfs, 'entryC' + i, [prev3, n2]))
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        let prev = null
        const onProgress = (hash, entry, parent, depth, have) => {
          let padding = []
          const isLast = parent ? parent.next.indexOf(hash) === parent.next.length - 1 : true
          prev = entry
          
          const amount = depth - 1
          for (let i = 0; i < amount; i ++) {
            padding.push("│ ")
          }
          const connectorChar = depth > 0 
            ? (isLast ? "└─" : "├─")
            : ""          

          console.log(padding.join("") + connectorChar + hash + " \"" + entry.payload + "\"" + (have ? " ✓" : ""))
        }


        // Limit the log size to 10 entries
        const a = await(Log.fromEntry(ipfs, last(items1).hash, 10))
        console.log(a.toString())
        assert.equal(a.items.length, 10)

        // Expand to 20 entries
        const b = await(Log.expand(ipfs, a, 20, onProgress))
        assert.equal(b.items.length, 20)
        assert.deepEqual(b.items.slice(-10), a.items)

        // Expand to max
        const c = await(Log.expand(ipfs, b))
        assert.equal(c.items.length, amount)
        assert.deepEqual(c.items.slice(-20), b.items)

        // Check for idempotency of expand()
        const d = await(Log.expand(ipfs, c))
        assert.equal(d.items.length, c.items.length)
        assert.deepEqual(c.items, d.items)
      }))

      it('throws an error if ipfs is not defined', () => {
        let err
        try {
          Log.expand()
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Ipfs instance not defined')
      })

      it('throws an error if log is not defined', () => {
        let err
        try {
          Log.expand(ipfs)
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Log instance not defined')
      })
    })

    describe('fromEntry', () => {
      let prev = null
      const onProgress = (hash, entry, parent, depth) => {
        let padding = []
        const isLast = parent ? parent.next.indexOf(hash) === parent.next.length - 1 : true
        prev = entry
        
        const amount = depth - 1
        for (let i = 0; i < amount; i ++) {
          padding.push("│ ")
        }
        const connectorChar = depth > 0 
          ? (isLast ? "└─" : "├─")
          : ""          

        console.log(padding.join("") + connectorChar + hash + " \"" + entry.payload)
      }

      it('onProgress callback is fired for each entry', async(() => {
        const log1 = Log.create()
        let items1 = []
        const amount = 100
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const n1 = await(Entry.create(ipfs, 'entryA' + i, [prev1]))
          items1.push(n1)
        }

        let i = 0
        let prevDepth = 0
        const callback = (hash, entry, parent, depth) => {
          assert.notEqual(entry, null)
          assert.equal(hash, items1[items1.length - i - 1].hash)
          assert.equal(entry.hash, items1[items1.length - i - 1].hash)
          assert.equal(entry.payload, items1[items1.length - i - 1].payload)
          assert.equal(depth, i)

          if (i > 0) {
            assert.equal(parent.payload, items1[items1.length - i].payload)
          }

          i ++
          prevDepth = depth
        }

        const hash = last(items1).hash
        const a = await(Log.fromEntry(ipfs, hash, -1, callback))
      }))

      it('retrieves partial log from an entry hash', async(() => {
        const log1 = Log.create()
        const log2 = Log.create()
        const log3 = Log.create()
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 100
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await(Entry.create(ipfs, 'entryA' + i, [prev1]))
          const n2 = await(Entry.create(ipfs, 'entryB' + i, [prev2, n1]))
          const n3 = await(Entry.create(ipfs, 'entryC' + i, [prev3, n2]))
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        console.log("limit to 10 entries")
        const a = await(Log.fromEntry(ipfs, last(items1).hash, 10))
        assert.equal(a.items.length, 10)

        const b = await(Log.fromEntry(ipfs, last(items1).hash, 42))
        assert.equal(b.items.length, 42)
      }))

      it('retrieves full log from an entry hash', async(() => {
        const log1 = Log.create()
        const log2 = Log.create()
        const log3 = Log.create()
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 10
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await(Entry.create(ipfs, 'entryA' + i, [prev1]))
          const n2 = await(Entry.create(ipfs, 'entryB' + i, [prev2, n1]))
          const n3 = await(Entry.create(ipfs, 'entryC' + i, [prev3, n2]))
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        const a = await(Log.fromEntry(ipfs, last(items1).hash, amount))
        assert.equal(a.items.length, amount)

        const b = await(Log.fromEntry(ipfs, last(items2).hash, amount * 2))
        assert.equal(b.items.length, amount * 2)

        const c = await(Log.fromEntry(ipfs, last(items3).hash, amount * 3))
        assert.equal(c.items.length, amount * 3)
      }))

      it('retrieves full log from an entry hash 2', async(() => {
        const log1 = Log.create()
        const log2 = Log.create()
        const log3 = Log.create()
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 10
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await(Entry.create(ipfs, 'entryA' + i, [prev1]))
          const n2 = await(Entry.create(ipfs, 'entryB' + i, [prev2, n1]))
          const n3 = await(Entry.create(ipfs, 'entryC' + i, [prev3, n1, n2]))
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        const a = await(Log.fromEntry(ipfs, last(items1).hash, amount))
        assert.equal(a.items.length, amount)

        const b = await(Log.fromEntry(ipfs, last(items2).hash, amount * 2))
        assert.equal(b.items.length, amount * 2)

        const c = await(Log.fromEntry(ipfs, last(items3).hash, amount * 3))
        assert.equal(c.items.length, amount * 3)
      }))

      it('retrieves full log from an entry hash 3', async(() => {
        const log1 = Log.create()
        const log2 = Log.create()
        const log3 = Log.create()
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 10
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await(Entry.create(ipfs, 'entryA' + i, [prev1]))
          const n2 = await(Entry.create(ipfs, 'entryB' + i, [prev2, n1]))
          const n3 = await(Entry.create(ipfs, 'entryC' + i, [prev3, n1, n2]))
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        const a = await(Log.fromEntry(ipfs, last(items1).hash, amount))
        assert.equal(a.items.length, amount)

        const b = await(Log.fromEntry(ipfs, last(items2).hash, amount * 2))
        assert.equal(b.items.length, amount * 2)

        let c = await(Log.fromEntry(ipfs, last(items3).hash, amount * 3))
        c = await(Log.append(ipfs, c, "EOF"))
        // console.log(c.items.map(e => e.payload))
        assert.equal(c.items.length, amount * 3 + 1)

        let logX = Log.create()
        logX = await(Log.append(ipfs, logX, "1"))
        logX = await(Log.append(ipfs, logX, "2"))
        logX = await(Log.append(ipfs, logX, "3"))
        const d = await(Log.fromEntry(ipfs, last(logX.items).hash))

        let e1 = Log.join(ipfs, c, d) // associative
        let e2 = Log.join(ipfs, d, c) // associative
        const e3 = Log.join(ipfs, c, c) // idempotent
        const ee = Log.join(ipfs, e3, e3) // idempotent
        const e4 = Log.join(ipfs, d, d) // idempotent
        assert.equal(e1.toString(), e2.toString())
        
        // console.log(c.items.map(e => e.payload))
        // console.log(e3.items.map(e => e.payload))
        // console.log(ee.items.map(e => e.payload))
        assert.equal(e3.toString(), c.toString())
        assert.equal(e4.toString(), d.toString())
        assert.equal(ee.toString(), e3.toString())
        assert.equal(ee.toString(), c.toString())

        e1 = await(Log.append(ipfs, e1, "DONE"))
        e2 = await(Log.append(ipfs, e2, "DONE"))
        const f = await(Log.fromEntry(ipfs, last(e1.items).hash, -1, onProgress))
        const g = await(Log.fromEntry(ipfs, last(e2.items).hash, -1, onProgress))

        console.log(f.toString())
        assert.equal(f.toString(), bigLogString)
        assert.equal(g.toString(), bigLogString)
        assert.equal(f.toString(), g.toString())
      }))

      it('throws an error if ipfs is not defined', () => {
        let err
        try {
          Log.fromEntry()
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Ipfs instance not defined')
      })
    })

    describe.skip('_fetchRecursive', () => {
      it('returns all items when none are in the log', async(() => {
        const log1 = Log.create()
        let entrys = []
        const amount = 1000
        for(let i = 1; i <= amount; i ++) {
          const prev = last(entrys)
          const n = await(Entry.create(ipfs, 'entry' + i, [prev]))
          entrys.push(n)
        }

        const st = new Date().getTime()
        const items = await(Log._fetchRecursive(ipfs, last(entrys).hash))
        const et = new Date().getTime()
        console.log("_fetchRecursive took " + (et - st) + "ms")

        assert.equal(items.length, amount)
        assert.equal(items[0].hash, entrys[0].hash)
        assert.equal(last(items).hash, last(entrys).hash)
      }))

      it('returns two items when neither are in the log', async(() => {
        const log1 = Log.create()
        const entry1 = await(Entry.create(ipfs, 'one'))
        const entry2 = await(Entry.create(ipfs, 'two', [entry1]))
        const items = await(Log._fetchRecursive(ipfs, entry2.hash))
        assert.equal(items.length, 2)
        assert.equal(items[0].hash, 'QmUrqiypsLPAWN24Y3gHarmDTgvW97bTUiXnqN53ySXM9V')
        assert.equal(items[1].hash, 'QmTRF2oGMG7L5yP6LU1bpy2DEdLTzkRByS9nshRkMAFhBy')
      }))

      it('returns three items when none are in the log', async(() => {
        const log1 = Log.create()
        const entry1 = await(Entry.create(ipfs, 'one'))
        const entry2 = await(Entry.create(ipfs, 'two', [entry1]))
        const entry3 = await(Entry.create(ipfs, 'three', [entry2]))
        const items = await(Log._fetchRecursive(ipfs, entry3.hash))
        assert.equal(items.length, 3)
        assert.equal(items[0].hash, 'QmUrqiypsLPAWN24Y3gHarmDTgvW97bTUiXnqN53ySXM9V')
        assert.equal(items[1].hash, 'QmTRF2oGMG7L5yP6LU1bpy2DEdLTzkRByS9nshRkMAFhBy')
        assert.equal(items[2].hash, 'QmQG1rPMjt1RQPQTu6cJfSMSS8GddcSw9GxLkVtRB32pMD')
      }))

      it('returns all items when none are in the log', async(() => {
        const log1 = Log.create()
        let entries = []
        const amount = 100
        for(let i = 1; i <= amount; i ++) {
          const prev = last(entries)
          const n = await(Entry.create(ipfs, 'entry' + i, [prev]))
          entries.push(n)
        }

        const items = await(Log._fetchRecursive(ipfs, last(entries).hash))
        assert.equal(items.length, amount)
        assert.equal(items[0].hash, entries[0].hash)
        assert.equal(last(items).hash, last(entries).hash)
      }))

      it('returns only the items that are not in the log', async(() => {
        let log1 = Log.create()
        log1 = await(Log.append(ipfs, log1, 'one'))
        const entry1 = log1.items[0]
        const entry2 = await(Entry.create(ipfs, 'two', [entry1]))
        const entry3 = await(Entry.create(ipfs, 'three', [entry2]))
        let allHashes = {}
        log1.items.forEach((a) => allHashes[a.hash] = a)
        const items = await(Log._fetchRecursive(ipfs, entry3.hash, allHashes))
        assert.equal(items.length, 2)
        assert.equal(items[0].hash, 'QmTRF2oGMG7L5yP6LU1bpy2DEdLTzkRByS9nshRkMAFhBy')
        assert.equal(items[1].hash, 'QmQG1rPMjt1RQPQTu6cJfSMSS8GddcSw9GxLkVtRB32pMD')
      }))

      it('throws an error if ipfs is not defined', () => {
        let err
        try {
          Log._fetchRecursive()
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Ipfs instance not defined')
      })
    })

    describe('_findHeads', () => {
      it('finds one head after one item', async(() => {
        let log1 = Log.create()
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        assert.equal(log1.heads.length, 1)
        assert.equal(log1.heads[0], 'QmQjjAwSt8qQQTQ52Kt3qMvS5squGiiEvrSRrkxYYMY3k2')
      }))

      it('finds one head after two items', async(() => {
        let log1 = Log.create()

        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))

        const heads = log1._heads
        assert.equal(heads.length, 1)
        assert.equal(heads[0], 'QmYFAWWAPXkyQuND7P8Fm2aLgTH7eAA44wYX8EeaYVGom9')
      }))

      it('finds head after a join and append', async(() => {
        let log1 = Log.create()
        let log2 = Log.create()

        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))

        log2 = Log.join(ipfs, log1, log2)
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        const expectedHead = last(log2.items)

        assert.equal(log2.heads.length, 1)
        assert.equal(log2.heads[0], expectedHead.hash)
      }))

      it('finds two heads after a join', async(() => {
        let log1 = Log.create()
        let log2 = Log.create()

        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        const expectedHead1 = last(log1.items)

        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        const expectedHead2 = last(log2.items)

        log1 = Log.join(ipfs, log1, log2)

        const heads = log1._heads
        assert.equal(heads.length, 2)
        assert.equal(heads[0], expectedHead2.hash)
        assert.equal(heads[1], expectedHead1.hash)
      }))

      it('finds two heads after two joins', async(() => {
        let log1 = Log.create()
        let log2 = Log.create()

        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log1 = Log.join(ipfs, log1, log2)
        log2 = await(Log.append(ipfs, log2, "helloB3"))
        log1 = await(Log.append(ipfs, log1, "helloA3"))
        log1 = await(Log.append(ipfs, log1, "helloA4"))
        const expectedHead1 = last(log1.items)
        const expectedHead2 = last(log2.items)
        log1 = Log.join(ipfs, log1, log2)

        const heads = log1._heads
        assert.equal(heads.length, 2)
        assert.equal(heads[1], expectedHead2.hash)
        assert.equal(heads[0], expectedHead1.hash)
      }))

      it('finds two heads after three joins', async(() => {
        let log1 = Log.create()
        let log2 = Log.create()
        let log3 = Log.create()

        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log1 = Log.join(ipfs, log1, log2)
        log1 = await(Log.append(ipfs, log1, "helloA3"))
        log1 = await(Log.append(ipfs, log1, "helloA4"))
        const expectedHead1 = last(log1.items)
        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))
        log2 = Log.join(ipfs, log2, log3)
        log2 = await(Log.append(ipfs, log2, "helloB3"))
        const expectedHead2 = last(log2.items)
        log1 = Log.join(ipfs, log1, log2)

        const heads = log1._heads
        assert.equal(heads.length, 2)
        assert.equal(heads[1], expectedHead2.hash)
        assert.equal(heads[0], expectedHead1.hash)
      }))

      it('finds three heads after three joins', async(() => {
        let log1 = Log.create()
        let log2 = Log.create()
        let log3 = Log.create()

        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log1 = Log.join(ipfs, log1, log2)
        log1 = await(Log.append(ipfs, log1, "helloA3"))
        log1 = await(Log.append(ipfs, log1, "helloA4"))
        const expectedHead1 = last(log1.items)
        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log2 = await(Log.append(ipfs, log2, "helloB3"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))
        const expectedHead2 = last(log2.items)
        const expectedHead3 = last(log3.items)
        log1 = Log.join(ipfs, log1, log2)
        log1 = Log.join(ipfs, log1, log3)

        const heads = log1._heads
        assert.equal(heads.length, 3)
        assert.equal(heads[0], expectedHead1.hash)
        assert.equal(heads[1], expectedHead2.hash)
        assert.equal(heads[2], expectedHead3.hash)
      }))
    })

    describe('_isReferencedInChain', () => {
      it('returns true if another entry in the log references the given entry', async(() => {
        let log = Log.create()
        log = await(Log.append(ipfs, log, 'one'))
        log = await(Log.append(ipfs, log, 'two'))
        const entry1 = log.items[0]
        const res = Log._isReferencedInChain(log.items, entry1)
        assert.equal(res, true)
      }))

      it('returns false if no other entry in the log references the given entry', async(() => {
        let log = Log.create()
        log = await(Log.append(ipfs, log, 'one'))
        log = await(Log.append(ipfs, log, 'two'))
        const entry2 = last(log.items)
        const res = Log._isReferencedInChain(log.items, entry2)
        assert.equal(res, false)
      }))
    })

    describe('_insert', () => {
      it('insert entry to the log before current batch if parent is in current bathc', async(() => {
        let log = Log.create()
        log = await(Log.append(ipfs, log, 'one'))
        log = await(Log.append(ipfs, log, 'two'))
        const entry1 = log.items[0]
        const entry3 = await(Entry.create(ipfs, 'three', [entry1]))
        Log._insert(ipfs, log, entry3)
        assert.equal(log.items.length, 3)
        assert.equal(log.items[0].payload, 'one')
      }))

      it('throws an error if ipfs is not defined', () => {
        let err
        try {
          Log._insert()
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Ipfs instance not defined')
      })

      it('throws an error if log is not defined', () => {
        let err
        try {
          Log._insert(ipfs)
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Log instance not defined')
      })
    })

    describe('is a CRDT', () => {
      let log1, log2, log3

      beforeEach(async(() => {
        log1 = Log.create()
        log2 = Log.create()
        log3 = Log.create()
      }))

      it('join is associative', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))

        // a + (b + c)
        const logA1 = Log.join(ipfs, log2, log3)
        const logA2 = Log.join(ipfs, log1, logA1)

        const res1 = logA2.items.map((e) => e.hash).join(",")

        log1 = Log.create()
        log2 = Log.create()
        log3 = Log.create()
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))

        // (a + b) + c
        const logB1 = Log.join(ipfs, log1, log2)
        const logB2 = Log.join(ipfs, logB1, log3)

        const res2 = logB2.items.map((e) => e.hash).join(",")

        // associativity: a + (b + c) == (a + b) + c
        const len = (46 + 1) * 6- 1 // 46 == ipfs hash, +1 == .join(","), * 4 == number of items, -1 == last item doesn't get a ',' from .join
        assert.equal(res1.length, len)
        assert.equal(res2.length, len)
        assert.equal(res1, res2)
      }))

      it('join is commutative', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))

        // b + a
        const log3 = Log.join(ipfs, log2, log1)
        const res1 = log3.items.map((e) => e.hash).join(",")

        log1 = Log.create()
        log2 = Log.create()
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))

        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))

        // a + b
        const log4 = Log.join(ipfs, log1, log2)
        const res2 = log4.items.map((e) => e.hash).join(",")

        // commutativity: a + b == b + a
        const len = (46 + 1) * 4 - 1 // 46 == ipfs hash length, +1 == .join(","), * 4 == number of items, -1 == last item doesn't get a ',' from .join
        assert.equal(res1.length, len)
        assert.equal(res2.length, len)
        assert.equal(res1, res2)
      }))

      it('multiple joins are commutative', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))

        // b + a == a + b
        const logA1 = Log.join(ipfs, log2, log1)
        const logA2 = Log.join(ipfs, log1, log2)
        assert.equal(logA1.toString(), logA2.toString())

        // a + b == b + a
        const logB1 = Log.join(ipfs, log1, log2)
        const logB2 = Log.join(ipfs, log2, log1)
        assert.equal(logB1.toString(), logB2.toString())

        // a + c == c + a
        const logC1 = Log.join(ipfs, log1, log3)
        const logC2 = Log.join(ipfs, log3, log1)
        assert.equal(logC1.toString(), logC2.toString())

        // c + b == b + c
        const logD1 = Log.join(ipfs, log3, log2)
        const logD2 = Log.join(ipfs, log2, log3)
        assert.equal(logD1.toString(), logD2.toString())

        // a + b + c == c + b + a
        const logX1 = Log.join(ipfs, log1, log2)
        const logX2 = Log.join(ipfs, logX1, log3)
        const logY1 = Log.join(ipfs, log3, log2)
        const logY2 = Log.join(ipfs, logY1, log1)
        assert.equal(logY2.toString(), logX2.toString())
      }))

      it('join is idempotent', async(() => {
        let logA = Log.create()
        let logB = Log.create()
        logA = await(Log.append(ipfs, logA, "helloA1"))
        logA = await(Log.append(ipfs, logA, "helloA2"))
        logA = await(Log.append(ipfs, logA, "helloA3"))
        logB = await(Log.append(ipfs, logB, "helloA1"))
        logB = await(Log.append(ipfs, logB, "helloA2"))
        logB = await(Log.append(ipfs, logB, "helloA3"))

        // idempotence: a + a = a
        const log = Log.join(ipfs, logA, logB)

        assert.equal(log.items.length, 3)
      }))
    })
  })

})
