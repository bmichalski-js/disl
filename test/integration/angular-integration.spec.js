"use strict"

describe('Integration with angular', function () {
  beforeEach(function () {
    if (typeof window === 'undefined') {
      this.skip()
    }
  })

  function makeTest(addServices, makeExpect) {
    return function () {
      //Declaration of angular modules and services
      const fooInstance = { isFoo: true }
      const barInstance = { isBar: true }

      const fooModule = angular.module('foo', [])

      addServices(fooModule, fooInstance, barInstance)

      //Done declaring angular modules and services

      const exposeAngularServicesModule = angular.module('exposeAngularServices', [])

      const container = new Container()

      exposeAngularServicesModule.run([ '$injector', function ($injector) {
        container.registerInstanceLocator((identifier) => {
          return new Promise((resolve) => {
            /**
             * Use $injector to inject / instantiate services on-demand
             */
            resolve($injector.get(identifier))
          })
        })
      }])

      //exposeAngularServices is loaded last to be able to access other modules services

      angular.bootstrap(undefined, [ 'foo', 'exposeAngularServices' ])

      return makeExpect(container, fooInstance, barInstance)
    }
  }

  it(
    'should be able to get an angular service as a container service',
    makeTest(
      function (fooModule, fooInstance, barInstance) {
        fooModule.service('foo', [function () {
          return fooInstance
        }])

        fooModule.service('bar', [ 'foo', function () {
          return barInstance
        }])
      },
      function (container, fooInstance, barInstance) {
        return Promise.all([
          expect(container.get('foo'))
            .to.eventually
            .deep.equal([fooInstance]),
          expect(container.get('bar'))
            .to.eventually
            .deep.equal([barInstance])
        ])
      }
    )
  )

  it('should throw an error if angular service does not exist', function () {
    const container = new Container()

    const exposeAngularServicesModule = angular.module('exposeAngularServices', [])

    exposeAngularServicesModule.run([ '$injector', function ($injector) {
      container.registerInstanceLocator((identifier) => {
        return new Promise((resolve) => {
          if ($injector.has(identifier)) {
            resolve($injector.get(identifier))
          } else {
            resolve()
          }
        })
      })
    }])

    angular.bootstrap(undefined, [ 'exposeAngularServices' ])

    return expect(container.get('unknown_service'))
      .to.eventually
      .be.instanceOf(Error)
      .and.be.rejectedWith(/^Missing service definition and instance for identifier "unknown_service"$/)
  })

  context('there is a circular dependency between angular services', function () {
    it(
      'should throw an Error',
      makeTest(
        function (fooModule, fooInstance, barInstance) {
          fooModule.service('foo', [ 'bar', function () {
            return fooInstance
          }])

          fooModule.service('bar', [ 'foo', function () {
            return barInstance
          }])
        },
        function (container) {
          return expect(container.get('foo'))
            .to.eventually
            .be.instanceOf(Error)
            .and.to.be.rejectedWith('Circular dependency found: foo <- bar <- foo')
        }
      )
    )
  })
})