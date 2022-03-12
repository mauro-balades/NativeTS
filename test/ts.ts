
class Hello {
    constructor() {
    }

    he() {
        this.llo()
    }

    llo() {
        var l = this.foo()
    }

    foo(): String {
        return "Hello"
    }
}


var h = new Hello()
h.he()
