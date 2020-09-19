#! /usr/bin/env yarn jest

import { StackedAreaTransform } from "./StackedAreaTransform"
import { basicGdpGrapher } from "grapher/test/samples"

describe(StackedAreaTransform, () => {
    it("can create a new transform and toggle relative mode", () => {
        const grapher = basicGdpGrapher()
        const transform = new StackedAreaTransform(grapher)
        expect(transform.verticalAxis.domain[1]).toBeGreaterThan(100)

        grapher.stackMode = "relative"
        expect(transform.verticalAxis.domain).toEqual([0, 100])
    })
})
