/* AxisSpec.ts
 * ================
 *
 * This represents a finalized version of the axis configuration
 * that is ready to go into rendering-- no unfilled nulls.
 */

import { ScaleType, TickFormattingOptions } from "charts/core/ChartConstants"
import { observable, computed } from "mobx"
import { extend } from "charts/utils/Util"

// Represents the actual entered configuration state in the editor
export interface AxisConfigInterface {
    min?: number
    max?: number
    scaleType: ScaleType
    canChangeScaleType?: true
    label?: string
    removePointsOutsideDomain?: true
}

export interface AxisSpec {
    scaleType: ScaleType
    scaleTypeOptions: ScaleType[]
    label: string
    domain: [number, number]

    tickFormat: (d: number, options?: TickFormattingOptions) => string
    hideFractionalTicks?: boolean
    hideGridlines?: boolean
}

export class AxisRuntime implements AxisConfigInterface {
    constructor(props?: AxisConfigInterface) {
        this.update(props)
    }

    update(props?: AxisConfigInterface) {
        if (props) extend(this, props)
    }

    @observable.ref min?: number = undefined
    @observable.ref max?: number = undefined
    @observable.ref scaleType: ScaleType = ScaleType.linear
    @observable.ref canChangeScaleType?: true = undefined
    @observable label: string = ""
    @observable.ref removePointsOutsideDomain?: true = undefined

    // A log scale domain cannot have values <= 0, so we
    // double check here
    @computed private get constrainedMin() {
        if (this.scaleType === ScaleType.log && (this.min || 0) <= 0)
            return Infinity
        return this.min ?? Infinity
    }

    isOutsideDomain(value: number) {
        return value < this.constrainedMin || value > this.constrainedMax
    }

    @computed private get constrainedMax() {
        if (this.scaleType === ScaleType.log && (this.max || 0) <= 0)
            return -Infinity
        return this.max ?? -Infinity
    }

    @computed get domain(): [number, number] {
        return [this.constrainedMin, this.constrainedMax]
    }

    @computed get scaleTypeOptions(): ScaleType[] {
        return this.canChangeScaleType
            ? [ScaleType.linear, ScaleType.log]
            : [this.scaleType]
    }

    // Convert axis configuration to a finalized axis spec by supplying
    // any needed information calculated from the data
    toSpec({ defaultDomain }: { defaultDomain: [number, number] }): AxisSpec {
        const { label, scaleType, scaleTypeOptions } = this
        return {
            label,
            tickFormat: d => `${d}`,
            domain: [
                Math.min(this.domain[0], defaultDomain[0]),
                Math.max(this.domain[1], defaultDomain[1])
            ],
            scaleType,
            scaleTypeOptions
        }
    }
}
